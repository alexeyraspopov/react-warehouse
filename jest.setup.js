import { unstable_toMatchRenderedOutput } from 'jest-react';
import { unstable_flushAllWithoutAsserting } from 'scheduler';

jest.mock('scheduler', () => require('scheduler/unstable_mock'));

expect.extend({ toMatchRenderedOutput: unstable_toMatchRenderedOutput });

global.flushScheduler = () => {
  unstable_flushAllWithoutAsserting();
};

global.flushPromise = () => {
  return new Promise((resolve) => setImmediate(resolve));
};
