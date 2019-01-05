import { useEffect } from 'react';

export function createResource(load, maxAge = 3000) {
  let cache = new Map();
  let refs = new Map();
  let timestamps = new Map();

  function isStale(key) {
    return refs.get(key) < 1 && Date.now() - timestamps.get(key) > maxAge;
  }

  function useLock(key) {
    useEffect(
      () => {
        let value = refs.get(key) || 0;
        refs.set(key, value + 1);
        return () => {
          let value = refs.get(key) || 0;
          refs.set(key, value - 1);
        };
      },
      [key]
    );
  }

  function putValue(key, value, tokens) {
    cache.set(key, value);
    refs.set(key, tokens);
    timestamps.set(key, Date.now());
  }

  function accessData(key, tokens) {
    let promise = load(key)
      .then(value => putValue(key, value, tokens))
      .catch(error => putValue(key, error, tokens));

    cache.set(key, promise);
    return promise;
  }

  function extractData(key) {
    let value = cache.get(key);

    if (value instanceof Promise || value instanceof Error) {
      throw value;
    }

    useLock(key);
    return value;
  }

  function read(key) {
    if (cache.has(key) && !isStale(key)) {
      return extractData(key);
    } else {
      throw accessData(key, 0);
    }
  }

  function preload(key) {
    if (!cache.has(key) || isStale(key)) {
      accessData(key, 1);
    }
    useLock(key);
  }

  return { read, preload };
}
