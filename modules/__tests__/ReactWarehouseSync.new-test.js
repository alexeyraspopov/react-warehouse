import React, { Suspense, Fragment } from 'react';
import { create, act } from 'react-test-renderer';
import { createResource } from '../ReactWarehouse';
import { experimental_useResourceSync as useResourceSync } from '../ReactWarehouse.new';
import { ErrorBoundary } from '../ErrorBoundary';

test('immediate resource resolving', async () => {
  function Component({ Resource, data }) {
    let value = useResourceSync(Resource, data);
    return <span>{value}</span>;
  }
  let query = jest.fn((data) => Promise.resolve('result:' + data));
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  act(() => {
    renderer.update(
      <Suspense fallback={<span>loading…</span>}>
        <Component Resource={Resource} data={['a']} />
      </Suspense>,
    );
  });
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>result:a</span>);
});

test('immediate resource rejection', async () => {
  function Component({ Resource, data }) {
    let value = useResourceSync(Resource, data);
    return <span>{value}</span>;
  }
  let query = jest.fn((data) => Promise.reject(new Error('failure:' + data)));
  let Resource = createResource({ query });
  let renderer = create(null, { unstable_isConcurrent: true });
  jest.spyOn(console, 'error').mockImplementation(() => null);
  act(() => {
    renderer.update(
      <ErrorBoundary fallback={<span>failure</span>}>
        <Suspense fallback={<span>loading…</span>}>
          <Component Resource={Resource} data={['a']} />
        </Suspense>
      </ErrorBoundary>,
    );
  });
  flushScheduler();
  expect(query).toHaveBeenCalledWith('a');
  expect(renderer).toMatchRenderedOutput(<span>loading…</span>);
  await act(() => flushPromise());
  flushScheduler();
  expect(query).toHaveBeenCalledTimes(1);
  expect(renderer).toMatchRenderedOutput(<span>failure</span>);
});
