import LRUCache from '../LRUCache';

test('LRUCache', () => {
  let onCleanup = jest.fn();
  let cache = LRUCache(3, onCleanup);

  expect(cache.size()).toEqual(0);

  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);

  expect(cache.get('c')).toEqual(3);

  cache.set('d', 4);

  expect(cache.size()).toEqual(3);
  expect(cache.get('a')).toEqual(undefined);
  expect(cache.get('b')).toEqual(2);

  cache.delete('b');

  expect(cache.size()).toEqual(2);
  expect(cache.has('b')).toBe(false);

  cache.set('b', 2);

  expect(cache.has('b')).toBe(true);

  cache.set('a', 1);
  cache.set('e', 5);
  cache.set('f', 6);

  expect(cache.has('b')).toBe(false);
  expect(cache.has('a')).toBe(true);
  expect(cache.has('e')).toBe(true);
  expect(cache.has('f')).toBe(true);
});
