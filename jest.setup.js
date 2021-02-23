let JestReact = require('jest-react');
let Scheduler = require('scheduler');

jest.mock('scheduler', () => require('scheduler/unstable_mock'));

expect.extend({
  toMatchRenderedOutput: JestReact.unstable_toMatchRenderedOutput,
  toFlushWithoutYielding(Scheduler) {
    Scheduler.unstable_flushAllWithoutAsserting();
    return { pass: true, message: 'All callbacks flushed' };
  },
  toFlushPendingCallbacks(Promise) {
    return new Promise((resolve) => {
      setImmediate(() => {
        resolve({ pass: true, message: 'All callbacks flushed' });
      });
    });
  },
});

global.flushScheduler = () => {
  Scheduler.unstable_flushAllWithoutAsserting();
};

global.flushPromise = () => {
  return new Promise((resolve) => setImmediate(resolve));
};
