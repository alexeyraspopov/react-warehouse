import hashCode from '../hashCode';

test('stable hashCode of well known values', () => {
  expect(hashCode(true)).toBe(0x42108421);
  expect(hashCode(false)).toBe(0x42108420);
  expect(hashCode(0)).toBe(0);
  expect(hashCode(Infinity)).toBe(0);
  expect(hashCode(null)).toBe(0x42108422);
  expect(hashCode(undefined)).toBe(0x42108423);
  expect(hashCode('a')).toBe(97);
  expect(hashCode(123)).toBe(123);
  expect(hashCode(4294967296)).toBe(1);
});

test('different hashes generation for decimal values', () => {
  expect(hashCode(123.456)).toBe(884763256);
  expect(hashCode(123.4567)).toBe(887769707);
});

test('different hashes generation for different objects', () => {
  let objA = {};
  let objB = {};
  expect(hashCode(objA)).toBe(hashCode(objA));
  expect(hashCode(objA)).not.toBe(hashCode(objB));
});

test('different hashes generation for different functions', () => {
  function funA() {}
  function funB() {}
  expect(hashCode(funA)).toBe(hashCode(funA));
  expect(hashCode(funA)).not.toBe(hashCode(funB));
});
