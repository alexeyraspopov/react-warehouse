import Signal from '../Signal';

test('Signal emitting', () => {
  let signal = Signal();
  let subscriberA = jest.fn();
  let subscriberB = jest.fn();
  let keyA = 'a';
  let keyB = 'b';
  let unsubscribeA = signal.subscribe(keyA, subscriberA);
  let unsubscribeB = signal.subscribe(keyA, subscriberB);
  signal.publish(keyA);
  signal.publish(keyB);
  expect(subscriberA).toHaveBeenCalledTimes(1);
  unsubscribeA();
  signal.publish(keyA);
  expect(subscriberA).toHaveBeenCalledTimes(1);
});
