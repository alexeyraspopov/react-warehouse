import React, { Suspense, Fragment } from 'react';
import * as Scheduler from 'scheduler';
import { create, act } from 'react-test-renderer';
import {
  createResource,
  useResourceFlow,
  useResourceValue,
  useResourceMutation,
} from '../ReactWarehouse';
import { ErrorBoundary } from '../ErrorBoundary';

function Parent({ Resource, deps, hook }) {
  let [resource, isPending] = useResourceFlow(Resource, deps);
  let mutate = useResourceMutation(Resource, resource);
  hook.mutate = mutate;
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

test('basic mutation of pre-queried resource flow', async () => {
  let query = jest.fn((data) => Promise.resolve('result:' + data));
  let mutate = jest.fn((payload) => Promise.resolve('result:' + payload));
  let Resource = createResource({ query, mutate });
  let renderer = create(null, { unstable_isConcurrent: true });
  let hook = { mutate: null };
  act(() => {
    renderer.update(<Parent Resource={Resource} deps={['a']} hook={hook} />);
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(async () => {
    await expect(Promise).toFlushPendingCallbacks();
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span pending={false}>result:a</span>);
  act(() => {
    hook.mutate('c');
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(mutate).toHaveBeenCalledWith('c');
  expect(renderer).toMatchRenderedOutput(<span pending={true}>result:a</span>);
  await act(async () => {
    await expect(Promise).toFlushPendingCallbacks();
  });
  expect(Scheduler).toFlushWithoutYielding();
  expect(renderer).toMatchRenderedOutput(<span pending={false}>result:c</span>);
});
