import React, { useState } from 'react';
import { create } from 'react-test-renderer';
import { ErrorBoundary } from '../ErrorBoundary';

function Failure({ error }) {
  throw error;
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementationOnce(() => null);
});

test('fallback content rendering', () => {
  let error = new Error();
  let renderer = create(
    <ErrorBoundary fallback={<span>fallback</span>}>
      <Failure error={error} />
    </ErrorBoundary>,
  );
  expect(renderer).toMatchRenderedOutput(<span>fallback</span>);
});

test('error handling callback', () => {
  let callback = jest.fn();
  let error = new Error();
  create(
    <ErrorBoundary fallback={null} onError={callback}>
      <Failure error={error} />
    </ErrorBoundary>,
  );
  expect(callback).toHaveBeenCalledWith(error);
});

test('derived fallback content', () => {
  function Container({ error }) {
    let [exception, setException] = useState(null);
    return (
      <ErrorBoundary
        fallback={<span>{exception && exception.message}</span>}
        onError={setException}
      >
        <Failure error={error} />
      </ErrorBoundary>
    );
  }
  let error = new Error('something');
  let renderer = create(<Container error={error} />);
  expect(renderer).toMatchRenderedOutput(<span>{error.message}</span>);
});
