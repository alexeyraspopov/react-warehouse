import React, { Suspense, Fragment } from 'react';
import * as Scheduler from 'scheduler';
import { create, act } from 'react-test-renderer';
import { useResourceFactory, useResourceValue } from '../ReactWarehouseV2';

function Parent({ id, query, cancel }) {
  let resource = useResourceFactory(() => {
    return cancel ? [query(id), cancel] : query(id);
  }, [id, query, cancel]);
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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    return this.state.error !== null
      ? this.props.fallback
      : this.props.children;
  }
}

test('sync rendering of resolved resource', () => {
  let query = jest.fn(data => 'result:' + data);
  let renderer = create(<Parent id="a" query={query} />);
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('async rendering of pending resource', async () => {
  let query = jest.fn(data => Promise.resolve('result:' + data));
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent id="a" query={query} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('async rendering of rejected resource', async () => {
  let query = jest.fn(data => Promise.reject('failure:' + data));
  let renderer = create(null, { unstable_isConcurrent: true });
  jest.spyOn(console, 'error').mockImplementation(() => null);
  act(() => {
    renderer.update(<Parent id="a" query={query} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>failure</span>);
});

test('query cancellation of pending resource', async () => {
  let query = jest.fn(data => Promise.resolve('result:' + data));
  let cancel = jest.fn();
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent id="a" query={query} cancel={cancel} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  act(() => {
    renderer.update(<Parent id="b" query={query} cancel={cancel} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('b');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});

test('subsequent re-rendering of new pending resource', async () => {
  let query = jest.fn(data => Promise.resolve('result:' + data));
  let cancel = jest.fn();
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent id="a" query={query} cancel={cancel} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => {
    renderer.update(<Parent id="b" query={query} cancel={cancel} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('b');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(cancel).not.toHaveBeenCalled();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});
