import React, { Suspense, Fragment } from 'react';
import * as Scheduler from 'scheduler';
import { create, act } from 'react-test-renderer';
import { createResource } from '../ReactWarehouse';
import {
  experimental_useResource as useResource,
  experimental_useResourcePendingState as useResourcePendingState,
  experimental_useResourceState as useResourceState,
} from '../ReactWarehouse.new';
import { ErrorBoundary } from '../ErrorBoundary';

function Parent({ Resource, deps, hook }) {
  let resource = useResource(Resource, deps);
  let isPending = useResourcePendingState(resource);
  return (
    <ErrorBoundary fallback={<span>failure</span>}>
      <Suspense fallback={<span>loading…</span>}>
        <Child resource={resource} isPending={isPending} hook={hook} />
      </Suspense>
    </ErrorBoundary>
  );
}

function Child({ resource, isPending, hook }) {
  let [value, mutate] = useResourceState(resource);
  hook.mutate = mutate;
  return <span pending={isPending}>{value}</span>;
}

test('basic mutation of pre-queried resource flow', async () => {
  let query = jest.fn((data) => Promise.resolve('result:' + data));
  let mutate = jest.fn((payload) => Promise.resolve('result:' + payload));
  let Resource = createResource({ query, mutate });
  let renderer = create(null, { unstable_isConcurrent: true });
  let hook = { mutate: null };
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} hook={hook} />);
  });
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span pending={false}>result:a</span>);
  act(() => {
    hook.mutate('c');
  });
  flushScheduler();
  expect(mutate).toHaveBeenCalledWith('c');
  expect(renderer).toMatchRenderedOutput(<span pending={true}>result:a</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(renderer).toMatchRenderedOutput(<span pending={false}>result:c</span>);
});
