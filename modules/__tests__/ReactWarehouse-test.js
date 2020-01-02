import React, { Suspense, Fragment } from 'react';
import * as Scheduler from 'scheduler';
import { create } from 'react-test-renderer';
import {
  createResource,
  useQuery,
  usePreloadedQuery,
  useQueryRef,
} from '../ReactWarehouse';

test('sync data rendering', () => {
  let query = jest.fn(key => 'test:' + key);
  let Resource = createResource({ query });
  function Component({ id }) {
    let string = useQuery(Resource, id);
    return <span>{string}</span>;
  }
  let renderer = create(<Component id="a" />);
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>test:a</span>);
});

test('async data rendering with fallback', async () => {
  let query = jest.fn(key => Promise.resolve('test:' + key));
  let Resource = createResource({ query });
  function Component({ id }) {
    let string = useQuery(Resource, id);
    return <span>{string}</span>;
  }
  let renderer = create(
    <Suspense fallback={<span>loading</span>}>
      <Component id="a" />
    </Suspense>,
    { unstable_isConcurrent: true },
  );
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>test:a</span>);
});

test('error boundary fallback', async () => {
  let query = jest.fn(key => Promise.reject('rejected:' + key));
  let Resource = createResource({ query });
  function Component({ id }) {
    let string = useQuery(Resource, id);
    return <span>{string}</span>;
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
  let renderer = create(
    <ErrorBoundary fallback={<span>failure</span>}>
      <Suspense fallback={<span>loading</span>}>
        <Component id="a" />
      </Suspense>
    </ErrorBoundary>,
    { unstable_isConcurrent: true },
  );
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>failure</span>);
});

test('reload skip', async () => {
  let query = jest.fn(key => Promise.resolve('test:' + key));
  let Resource = createResource({ query, maxAge: 1000 });
  function Component({ id }) {
    let string = useQuery(Resource, id);
    return <span>{string}</span>;
  }
  let renderer = create(
    <Suspense fallback={<span>loading</span>}>
      <Component id="a" />
    </Suspense>,
    { unstable_isConcurrent: true },
  );
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>loading</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>test:a</span>);
  renderer.update(
    <Suspense fallback={<span>loading</span>}>
      <Component id="a" />
      <Component id="a" />
    </Suspense>,
  );
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(
    <Fragment>
      <span>test:a</span>
      <span>test:a</span>
    </Fragment>,
  );
});

test('stale data reload', async () => {
  let query = jest.fn(key => Promise.resolve('test:' + key));
  let Resource = createResource({ query, maxAge: 1 });
  function Component({ id }) {
    let string = useQuery(Resource, id);
    return <span>{string}</span>;
  }
  let renderer = create(
    <Suspense fallback={<span>loading</span>}>
      <Component id="a" />
    </Suspense>,
    { unstable_isConcurrent: true },
  );
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>loading</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>test:a</span>);
  renderer.update(<span>boom</span>);
  expect(Scheduler).toFlushWithoutYielding();
  await new Promise(r => setTimeout(r, 10));
  renderer.update(
    <Suspense fallback={<span>loading</span>}>
      <Component id="a" />
    </Suspense>,
  );
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>loading</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(2);
  expect(renderer).toMatchRenderedOutput(<span>test:a</span>);
});

test('data preload', async () => {
  let query = jest.fn(key => Promise.resolve('test:' + key));
  let Resource = createResource({ query, maxAge: 1 });
  function Shell({ id }) {
    usePreloadedQuery(Resource, id);
    return <span>nothing</span>;
  }
  function Component({ id }) {
    let string = useQuery(Resource, id);
    return <span>{string}</span>;
  }
  let renderer = create(<Shell id="a" />, { unstable_isConcurrent: true });
  expect(Scheduler).toFlushWithoutYielding();
  await expect(Promise).toFlushPendingCallbacks();
  renderer.update(<Component id="a" />);
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>test:a</span>);
});

test('data preload by reference', async () => {
  let query = jest.fn(key => Promise.resolve('test:' + key));
  let Resource = createResource({ query, maxAge: 1 });
  function Shell({ id, flag }) {
    let ref = usePreloadedQuery(Resource, id);
    return flag ? <Component dataRef={ref} /> : <span>nothing</span>;
  }
  function Component({ dataRef }) {
    let string = useQueryRef(dataRef);
    return <span>{string}</span>;
  }
  let renderer = create(<Shell id="a" />, { unstable_isConcurrent: true });
  expect(Scheduler).toFlushWithoutYielding();
  await expect(Promise).toFlushPendingCallbacks();
  renderer.update(<Shell id="a" flag />);
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>test:a</span>);
});

test('data preload by reference with suspense', async () => {
  let query = jest.fn(key => Promise.resolve('test:' + key));
  let Resource = createResource({ query, maxAge: 1 });
  function Shell({ id, flag }) {
    let ref = usePreloadedQuery(Resource, id);
    return flag ? (
      <Suspense fallback={<span>loading</span>}>
        <Component dataRef={ref} />
      </Suspense>
    ) : (
      <span>nothing</span>
    );
  }
  function Component({ dataRef }) {
    let string = useQueryRef(dataRef);
    return <span>{string}</span>;
  }
  let renderer = create(<Shell id="a" />, { unstable_isConcurrent: true });
  expect(Scheduler).toFlushWithoutYielding();
  renderer.update(<Shell id="a" flag />);
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>loading</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>test:a</span>);
});

test('request cancellation on capacity', async () => {
  let cancel = jest.fn();
  let query = jest.fn(key => [Promise.resolve('test:' + key), cancel]);
  let Resource = createResource({ query, capacity: 1 });
  function Component({ id }) {
    let string = useQuery(Resource, id);
    return <span>{string}</span>;
  }
  let renderer = create(
    <Suspense fallback={<span>loading</span>}>
      <Component id="a" />
    </Suspense>,
    { unstable_isConcurrent: true },
  );
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading</span>);
  renderer.update(
    <Suspense fallback={<span>loading</span>}>
      <Component id="b" />
    </Suspense>,
  );
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>loading</span>);
  await expect(Promise).toFlushPendingCallbacks();
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span>test:b</span>);
  expect(query).toHaveBeenCalledTimes(2);
  expect(cancel).toHaveBeenCalledTimes(1);
});
