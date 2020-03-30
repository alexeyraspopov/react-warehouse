import React, { Suspense, Fragment } from 'react';
import * as Scheduler from 'scheduler';
import { create, act } from 'react-test-renderer';
import { useResourceFactory, useResourceValue } from '../ReactWarehouse';
import { ErrorBoundary } from '../ErrorBoundary';

function Parent({ factory, data }) {
  let resource = useResourceFactory(() => factory(data), [factory, data]);
  return (
    <ErrorBoundary fallback={<span>failure</span>}>
      <Suspense fallback={<span>loading…</span>}>
        <Child resource={resource} />
      </Suspense>
    </ErrorBoundary>
  );
}

function Child({ resource }) {
  let value = useResourceValue(resource);
  return <span>{value}</span>;
}

test('sync rendering of resolved resource', () => {
  let query = jest.fn((data) => 'result:' + data);
  let renderer = create(<Parent factory={query} data="a" />);
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('async rendering of pending resource', async () => {
  let query = jest.fn((data) => Promise.resolve('result:' + data));
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent factory={query} data="a" />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(async () => {
    await expect(Promise).toFlushPendingCallbacks();
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('async rendering of rejected resource', async () => {
  let query = jest.fn((data) => Promise.reject('failure:' + data));
  let renderer = create(null, { unstable_isConcurrent: true });
  jest.spyOn(console, 'error').mockImplementation(() => null);
  act(() => {
    renderer.update(<Parent factory={query} data="a" />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(async () => {
    await expect(Promise).toFlushPendingCallbacks();
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>failure</span>);
});

test('query cancellation of pending resource', async () => {
  let cancel = jest.fn();
  let query = jest.fn((data) => [Promise.resolve('result:' + data), cancel]);
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent factory={query} data="a" />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  act(() => {
    renderer.update(<Parent factory={query} data="b" />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('b');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(async () => {
    await expect(Promise).toFlushPendingCallbacks();
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});

test('subsequent re-rendering of new pending resource', async () => {
  let cancel = jest.fn();
  let query = jest.fn((data) => [Promise.resolve('result:' + data), cancel]);
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent factory={query} data="a" />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(async () => {
    await expect(Promise).toFlushPendingCallbacks();
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => {
    renderer.update(<Parent factory={query} data="b" />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('b');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(async () => {
    await expect(Promise).toFlushPendingCallbacks();
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(cancel).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});
