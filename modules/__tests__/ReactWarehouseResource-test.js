import React, { Suspense, Fragment } from 'react';
import * as Scheduler from 'scheduler';
import { create, act } from 'react-test-renderer';
import {
  createResource,
  useResource,
  useResourceValue,
} from '../ReactWarehouseV2';

function Parent({ Resource, deps }) {
  let resource = useResource(Resource, deps);
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
  let Resource = createResource({ query });
  let renderer = create(<Parent Resource={Resource} deps={['a']} />);
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('async rendering of pending resource', async () => {
  let query = jest.fn(data => Promise.resolve('result:' + data));
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
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
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  jest.spyOn(console, 'error').mockImplementation(() => null);
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>failure</span>);
});

test('skipped rendering of resolved resource', async () => {
  let query = jest.fn(data => Promise.resolve('result:' + data));
  let Resource = createResource({ query, maxAge: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(
      <Fragment>
        <Parent Resource={Resource} deps={['a']} />
      </Fragment>,
    );
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  await new Promise(r => setTimeout(r, 500));
  act(() => {
    renderer.update(
      <Fragment>
        <Parent Resource={Resource} deps={['a']} />
        <Parent Resource={Resource} deps={['a']} />
      </Fragment>,
    );
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>result:a</span>
      <span>result:a</span>
    </Fragment>,
  );
});

test('skipped rendering of not expired resource', async () => {
  let query = jest.fn(data => Promise.resolve('result:' + data));
  let Resource = createResource({ query, maxAge: 10000 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => {
    renderer.update(null);
  });
  expect(Scheduler).toFlushWithoutYielding();
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('skipped rendering of singleton resource', async () => {
  let query = jest.fn(() => Promise.resolve('the result'));
  let Resource = createResource({ query, maxAge: 5000 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={[]} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalled();
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>the result</span>);
  act(() => {
    renderer.update(null);
  });
  expect(Scheduler).toFlushWithoutYielding();
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={[]} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>the result</span>);
});

test('re-fetching of expired resource', async () => {
  let query = jest.fn(data => Promise.resolve('result:' + data));
  let Resource = createResource({ query, maxAge: 10 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
  act(() => {
    renderer.update(null);
  });
  expect(Scheduler).toFlushWithoutYielding();
  await new Promise(r => setTimeout(r, 500));
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(2);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('cancellation of out-of-range resource', async () => {
  let cancel = jest.fn();
  let query = jest.fn(data => [Promise.resolve('result:' + data), cancel]);
  let Resource = createResource({ query, capacity: 1 });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(cancel).not.toHaveBeenCalled();
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['b']} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('b');
  expect(cancel).toHaveBeenCalled();
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>result:b</span>);
});