import React, { Suspense, Fragment } from 'react';
import * as Scheduler from 'scheduler';
import { create, act } from 'react-test-renderer';
import {
  createResource,
  useResourceFlow,
  useResourceValue,
} from '../ReactWarehouse';
import { ErrorBoundary } from '../ErrorBoundary';

function Parent({ Resource, deps }) {
  let [resource, isPending] = useResourceFlow(Resource, deps);
  return (
    <ErrorBoundary fallback={<span>failure</span>}>
      <Suspense fallback={<span>loading…</span>}>
        <Child resource={resource} isPending={isPending} />
      </Suspense>
    </ErrorBoundary>
  );
}

function Child({ resource, isPending }) {
  let value = useResourceValue(resource);
  return <span pending={isPending}>{value}</span>;
}

test('sync rendering of resolved resource', () => {
  let query = jest.fn((data) => 'result:' + data);
  let Resource = createResource({ query });
  let renderer = create(<Parent Resource={Resource} deps={['a']} />);
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span pending={false}>result:a</span>);
});

test('async rendering of pending resource', async () => {
  let query = jest.fn((data) => Promise.resolve('result:' + data));
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
  });
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span pending={false}>result:a</span>);
});

test('async rendering of rejected resource', async () => {
  let query = jest.fn((data) => Promise.reject('failure:' + data));
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  jest.spyOn(console, 'error').mockImplementation(() => null);
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
  });
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>failure</span>);
});

test('async rendering of subsequent requests', async () => {
  let query = jest.fn((data) => Promise.resolve('result:' + data));
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
  });
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span pending={false}>result:a</span>);
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['b']} />);
  });
  flushScheduler();
  expect(query).toHaveBeenCalledWith('b');
  expect(renderer).toMatchRenderedOutput(<span pending={true}>result:a</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(2);
  expect(renderer).toMatchRenderedOutput(<span pending={false}>result:b</span>);
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
  });
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span pending={false}>result:a</span>);
});

test('race condition prevention', async () => {
  let query = jest.fn((data) => Promise.resolve('result:' + data));
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
  });
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span pending={false}>result:a</span>);
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['b']} />);
  });
  flushScheduler();
  expect(query).toHaveBeenCalledWith('b');
  expect(renderer).toMatchRenderedOutput(<span pending={true}>result:a</span>);
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['c']} />);
  });
  flushScheduler();
  expect(query).toHaveBeenCalledWith('c');
  expect(renderer).toMatchRenderedOutput(<span pending={true}>result:a</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(3);
  expect(renderer).toMatchRenderedOutput(<span pending={false}>result:c</span>);
});
