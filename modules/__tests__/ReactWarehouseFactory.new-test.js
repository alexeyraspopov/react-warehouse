import React from 'react';
import { create, act } from 'react-test-renderer';
import { Fragment, Suspense } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import {
  experimental_useResourceFactory as useResourceFactory,
  experimental_useResourcePendingState as useResourcePendingState,
  experimental_useResourceRetryCallback as useResourceRetryCallback,
  experimental_useResourceState as useResourceState,
  experimental_useResourceValue as useResourceValue,
} from '../ReactWarehouse.new';

function Parent({ query, data = [] }) {
  let resource$ = useResourceFactory(query, data);
  return (
    <ErrorBoundary fallback={<span>failure</span>}>
      <Suspense fallback={<span>loading…</span>}>
        <Child resource$={resource$} />
      </Suspense>
    </ErrorBoundary>
  );
}

function Child({ resource$ }) {
  let value = useResourceValue(resource$);
  return <span>{value}</span>;
}

test('async rendering of pending resource', async () => {
  let query = jest.fn(() => Promise.resolve('result:a'));
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent query={query} data={[]} />));
  flushScheduler();
  expect(query).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('async rendering of rejected resource', async () => {
  let query = jest.fn(() => Promise.reject(new Error('failure:a')));
  let renderer = create(null, { unstable_isConcurrent: true });
  jest.spyOn(console, 'error').mockImplementation(() => null);
  act(() => renderer.update(<Parent query={query} data={[]} />));
  flushScheduler();
  expect(query).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>failure</span>);
});

test('query cancellation during unmount', async () => {
  let cancel = jest.fn();
  let query = jest.fn(() => [Promise.resolve('result:a'), cancel]);
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent query={query} data={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  act(() => renderer.update(<div />));
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<div />);
  expect(cancel).toHaveBeenCalled();
});

test('query cancellation of pending resource', async () => {
  let cancel = jest.fn();
  let queryA = jest.fn(() => [Promise.resolve('result:a'), cancel]);
  let queryB = jest.fn(() => [Promise.resolve('result:b'), cancel]);
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent query={queryA} data={['a']} />));
  flushScheduler();
  expect(queryA).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  act(() => renderer.update(<Parent query={queryB} data={['b']} />));
  flushScheduler();
  expect(queryB).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});

test('subsequent re-rendering of new pending resource', async () => {
  let cancel = jest.fn();
  let queryA = jest.fn(() => [Promise.resolve('result:a'), cancel]);
  let queryB = jest.fn(() => [Promise.resolve('result:b'), cancel]);
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent query={queryA} data={['a']} />));
  flushScheduler();
  expect(queryA).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => renderer.update(<Parent query={queryB} data={['b']} />));
  flushScheduler();
  expect(queryB).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(cancel).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});

test('post suspense pending state handling', async () => {
  function Parent({ query, data = [] }) {
    let resource$ = useResourceFactory(query, data);
    let isPending = useResourcePendingState(resource$);
    return (
      <ErrorBoundary fallback={<span>failure</span>}>
        <Suspense
          fallback={<span>loading…({isPending ? 'pending' : 'resolved'})</span>}
        >
          <Child resource$={resource$} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  function Child({ resource$ }) {
    let value = useResourceValue(resource$);
    let isPending = useResourcePendingState(resource$);
    return (
      <Fragment>
        <span>{isPending ? 'pending' : 'resolved'}</span>
        <span>{value}</span>
      </Fragment>
    );
  }

  let cancel = jest.fn();
  let queryA = jest.fn(() => [Promise.resolve('result:a'), cancel]);
  let queryB = jest.fn(() => [Promise.resolve('result:b'), cancel]);
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent query={queryA} data={['a']} />));
  flushScheduler();
  expect(queryA).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…(resolved)</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>resolved</span>
      <span>result:a</span>
    </Fragment>,
  );
  act(() => renderer.update(<Parent query={queryB} data={['b']} />));
  flushScheduler();
  expect(queryB).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>pending</span>
      <span>result:a</span>
    </Fragment>,
  );
  await act(() => flushPromise());
  flushScheduler();
  expect(cancel).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>resolved</span>
      <span>result:b</span>
    </Fragment>,
  );
});

test('subsequent cancellation of pending resource', async () => {
  let cancelA = jest.fn();
  let cancelB = jest.fn();
  let cancelC = jest.fn();
  let queryA = jest.fn(() => [Promise.resolve('result:a'), cancelA]);
  let queryB = jest.fn(() => [Promise.resolve('result:b'), cancelB]);
  let queryC = jest.fn(() => [Promise.resolve('result:c'), cancelC]);
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent query={queryA} data={['a']} />));
  flushScheduler();
  expect(queryA).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => renderer.update(<Parent query={queryB} data={['b']} />));
  flushScheduler();
  expect(queryB).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => renderer.update(<Parent query={queryC} data={['c']} />));
  flushScheduler();
  expect(queryC).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(cancelA).not.toHaveBeenCalled();
  expect(cancelB).toHaveBeenCalled();
  expect(cancelC).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:c</span>);
});

test('subsequent re-rendering of new pending resource during suspense', async () => {
  let resolveA;
  let promiseA = new Promise((resolve) => {
    resolveA = resolve;
  });
  let cancelA = jest.fn();
  let queryA = jest.fn(() => [promiseA, cancelA]);

  let resolveB;
  let promiseB = new Promise((resolve) => {
    resolveB = resolve;
  });
  let cancelB = jest.fn();
  let queryB = jest.fn(() => [promiseB, cancelB]);

  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent query={queryA} data={['a']} />));
  flushScheduler();
  expect(queryA).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  act(() => renderer.update(<Parent query={queryB} data={['b']} />));
  flushScheduler();
  expect(queryB).toHaveBeenCalled();
  expect(cancelA).toHaveBeenCalled();
  resolveB('result:b');
  await act(() => flushPromise());
  flushScheduler();
  expect(cancelB).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
  resolveA('result:a');
  await act(() => flushPromise());
  flushScheduler();
  expect(cancelB).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});

test('sync value update via setter', async () => {
  let setValueFn;
  function Parent({ query, data = [] }) {
    let resource$ = useResourceFactory(query, data);
    return (
      <ErrorBoundary fallback={<span>failure</span>}>
        <Suspense fallback={<span>loading…</span>}>
          <Child resource$={resource$} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  function Child({ resource$ }) {
    let [value, setValue] = useResourceState(resource$);
    setValueFn = setValue;
    return <span>{value}</span>;
  }

  let cancelA = jest.fn();
  let cancelB = jest.fn();
  let queryA = jest.fn(() => [Promise.resolve('result:a'), cancelA]);
  let queryB = jest.fn(() => [Promise.resolve('result:b'), cancelB]);
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent query={queryA} data={['a']} />));
  flushScheduler();
  expect(queryA).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => setValueFn('result:set'));
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:set</span>);
  act(() => renderer.update(<Parent query={queryB} data={['b']} />));
  flushScheduler();
  expect(queryB).toHaveBeenCalled();
  expect(cancelA).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:set</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});

test('latest query retry', async () => {
  let retryResourceFn;
  function Parent({ query, data = [] }) {
    let resource$ = useResourceFactory(query, data);
    let retryResource = useResourceRetryCallback(resource$);
    retryResourceFn = retryResource;
    return (
      <ErrorBoundary fallback={<span>failure</span>}>
        <Suspense fallback={<span>loading…</span>}>
          <Child resource$={resource$} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  function Child({ resource$ }) {
    let value = useResourceValue(resource$);
    let isPending = useResourcePendingState(resource$);
    return (
      <Fragment>
        <span>{isPending ? 'pending' : 'resolved'}</span>
        <span>{value}</span>
      </Fragment>
    );
  }

  let cancel = jest.fn();
  let retryCounter = 0;
  let query = jest.fn(() => [
    Promise.resolve('result:a:' + retryCounter++),
    cancel,
  ]);
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent query={query} data={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>resolved</span>
      <span>result:a:0</span>
    </Fragment>,
  );
  act(() => retryResourceFn());
  flushScheduler();
  expect(query).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>pending</span>
      <span>result:a:0</span>
    </Fragment>,
  );
  await act(() => flushPromise());
  flushScheduler();
  expect(cancel).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>resolved</span>
      <span>result:a:1</span>
    </Fragment>,
  );
});
