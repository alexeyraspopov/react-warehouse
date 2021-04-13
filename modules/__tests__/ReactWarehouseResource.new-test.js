import React from 'react';
import { create, act } from 'react-test-renderer';
import { Fragment, Suspense } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import { createResource } from '../ReactWarehouse';
import {
  experimental_useResource as useResource,
  experimental_useResourcePendingState as useResourcePendingState,
  experimental_useResourceRetryCallback as useResourceRetryCallback,
  experimental_useResourceState as useResourceState,
  experimental_useResourceValue as useResourceValue,
} from '../ReactWarehouse.new';

function Parent({ Resource, deps = [] }) {
  let resource$ = useResource(Resource, deps);
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
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('async rendering of rejected resource', async () => {
  let query = jest.fn(() => Promise.reject(new Error('failure:a')));
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  jest.spyOn(console, 'error').mockImplementation(() => null);
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>failure</span>);
});

test('transition from resolved to rejected', async () => {
  let query = jest.fn(() => Promise.resolve('result:a'));
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  query.mockImplementation(() => Promise.reject(new Error('failure:b')));
  act(() => renderer.update(<Parent Resource={Resource} deps={['b']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('b');
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>failure</span>);
});

test('query cancellation of pending resource', async () => {
  let cancel = jest.fn();
  let query = jest.fn((v) => [Promise.resolve('result:' + v), cancel]);
  let Resource = createResource({ query, capacity: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  act(() => renderer.update(<Parent Resource={Resource} deps={['b']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('b');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});

test('subsequent re-rendering of new pending resource', async () => {
  let cancel = jest.fn();
  let query = jest.fn((v) => [Promise.resolve('result:' + v), cancel]);
  let Resource = createResource({ query, capacity: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => renderer.update(<Parent Resource={Resource} deps={['b']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('b');
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(cancel).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});

test('post suspense pending state handling', async () => {
  function Parent({ Resource, deps = [] }) {
    let resource$ = useResource(Resource, deps);
    let isPending = useResourcePendingState(resource$);
    return (
      <ErrorBoundary fallback={<span>failure</span>}>
        <Suspense fallback={<span>loading…({isPending ? 'pending' : 'resolved'})</span>}>
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
  let query = jest.fn((v) => [Promise.resolve('result:' + v), cancel]);
  let Resource = createResource({ query, capacity: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…(resolved)</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>resolved</span>
      <span>result:a</span>
    </Fragment>,
  );
  act(() => renderer.update(<Parent Resource={Resource} deps={['b']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('b');
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
  let cancel = jest.fn();
  let query = jest.fn((v) => [Promise.resolve('result:' + v), cancel]);
  let Resource = createResource({ query, capacity: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => renderer.update(<Parent Resource={Resource} deps={['b']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('b');
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => renderer.update(<Parent Resource={Resource} deps={['c']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('c');
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:c</span>);
});

test('subsequent re-rendering of new pending resource during suspense', async () => {
  let resolveA;
  let promiseA = new Promise((resolve) => {
    resolveA = resolve;
  });
  let resolveB;
  let promiseB = new Promise((resolve) => {
    resolveB = resolve;
  });
  let promises = { a: promiseA, b: promiseB };
  let cancels = { a: jest.fn(), b: jest.fn() };
  let query = jest.fn((v) => [promises[v], cancels[v]]);
  let Resource = createResource({ query, capacity: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  act(() => renderer.update(<Parent Resource={Resource} deps={['b']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('b');
  expect(cancels.a).toHaveBeenCalled();
  resolveB('result:b');
  await act(() => flushPromise());
  flushScheduler();
  expect(cancels.b).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
  resolveA('result:a');
  await act(() => flushPromise());
  flushScheduler();
  expect(cancels.b).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});

test('sync value update via setter', async () => {
  let setValueFn;
  function Parent({ Resource, deps = [] }) {
    let resource$ = useResource(Resource, deps);
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

  let cancel = jest.fn();
  let query = jest.fn((v) => [Promise.resolve('result:' + v), cancel]);
  let Resource = createResource({ query, capacity: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => setValueFn('result:set'));
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:set</span>);
  act(() => renderer.update(<Parent Resource={Resource} deps={['b']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('b');
  expect(cancel).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:set</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});

test('latest query retry', async () => {
  let retryResourceFn;
  function Parent({ Resource, deps = [] }) {
    let resource$ = useResource(Resource, deps);
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
  let query = jest.fn(() => [Promise.resolve('result:a:' + retryCounter++), cancel]);
  let Resource = createResource({ query, capacity: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
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

test('preliminary retry or update during initial or pending query', async () => {
  let retryResourceFn;
  function Parent({ Resource, deps = [] }) {
    let resource$ = useResource(Resource, deps);
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
  let query = jest.fn(() => [Promise.resolve('result:a:' + retryCounter++), cancel]);
  let Resource = createResource({ query, capacity: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  act(() => retryResourceFn());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  expect(cancel).toHaveBeenCalled();
  expect(query).toHaveBeenCalledTimes(2);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>resolved</span>
      <span>result:a:1</span>
    </Fragment>,
  );
});

test('pulling resolved data from cache', async () => {
  let cancel = jest.fn();
  let query = jest.fn((v) => [Promise.resolve('result:' + v), cancel]);
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() =>
    renderer.update(
      <Fragment>
        <Parent Resource={Resource} deps={['a']} />
      </Fragment>,
    ),
  );
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() =>
    renderer.update(
      <Fragment>
        <Parent Resource={Resource} deps={['a']} />
        <Parent Resource={Resource} deps={['a']} />
      </Fragment>,
    ),
  );
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>result:a</span>
      <span>result:a</span>
    </Fragment>,
  );
});

test('pulling resolved data from cache that is not old yet', async () => {
  let query = jest.fn((data) => Promise.resolve('result:' + data));
  let Resource = createResource({ query, maxAge: 10000 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => renderer.update(null));
  flushScheduler();
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('pulling old data with following query', async () => {
  let query = jest.fn((data) => Promise.resolve('result:' + data));
  let Resource = createResource({ query, maxAge: 200, staleAge: 1000 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => renderer.update(null));
  flushScheduler();
  await new Promise((r) => setTimeout(r, 400));
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  expect(query).toHaveBeenCalledTimes(2);
});

test('consistent cache usage via refs', async () => {
  let query = jest.fn((data) => Promise.resolve('result:' + data));
  let Resource = createResource({ query, maxAge: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(
      <Fragment>
        <Parent Resource={Resource} deps={['a']} />
      </Fragment>,
    );
  });
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  await new Promise((r) => setTimeout(r, 200));
  act(() => {
    renderer.update(
      <Fragment>
        <Parent Resource={Resource} deps={['a']} />
        <Parent Resource={Resource} deps={['a']} />
      </Fragment>,
    );
  });
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>result:a</span>
      <span>result:a</span>
    </Fragment>,
  );
});

test('skipped rendering of singleton resource', async () => {
  let query = jest.fn(() => Promise.resolve('the result'));
  let Resource = createResource({ query, maxAge: 5000 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={[]} />));
  flushScheduler();
  expect(query).toHaveBeenCalled();
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>the result</span>);
  act(() => renderer.update(null));
  flushScheduler();
  act(() => renderer.update(<Parent Resource={Resource} deps={[]} />));
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>the result</span>);
});

test('re-fetching of expired resource', async () => {
  let query = jest.fn((data) => Promise.resolve('result:' + data));
  let Resource = createResource({ query, maxAge: 10, staleAge: 0 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => renderer.update(null));
  flushScheduler();
  await new Promise((r) => setTimeout(r, 500));
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(2);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('cancellation of out-of-range resource', async () => {
  let cancel = jest.fn();
  let query = jest.fn((data) => [Promise.resolve('result:' + data), cancel]);
  let Resource = createResource({ query, capacity: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => renderer.update(<Parent Resource={Resource} deps={['a']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(cancel).not.toHaveBeenCalled();
  act(() => renderer.update(<Parent Resource={Resource} deps={['b']} />));
  flushScheduler();
  expect(query).toHaveBeenCalledWith('b');
  expect(cancel).toHaveBeenCalled();
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});
