import { createContext, useContext, useEffect, useDebugValue } from 'react';
import LRUCache from './LRUCache';

let Pending = 0;
let Resolved = 1;
let Rejected = 2;

let Registry = createContext(new Map());

let ResourcePrototype = {
  query: null,
  getCacheKey: identity,
  maxAge: 10000,
  capacity: 512,
};

export function createResource(options) {
  let resource = Object.assign({}, ResourcePrototype, options);
  return resource;
}

export function useQuery(resource, input) {
  let cache = useRecordCache(resource);
  let record = lookupRecord(resource, cache, input);
  let value = unwrapRecordValue(record);
  useRecordLock(record);
  useDebugValue(value);
  return value;
}

export function usePreloadedQuery(resource, input) {
  let cache = useRecordCache(resource);
  let record = lookupRecord(resource, cache, input);
  useRecordLock(record);
  useDebugValue(record);
  return record;
}

export function useQueryRef(record) {
  let value = unwrapRecordValue(record);
  useRecordLock(record);
  useDebugValue(value);
  return value;
}

function useRecordCache(resource) {
  let registry = useContext(Registry);
  if (registry.has(resource)) {
    return registry.get(resource);
  }
  let cache = LRUCache(resource.capacity, cleanupRecord);
  registry.set(resource, cache);
  return cache;
}

function useRecordLock(record) {
  useEffect(() => {
    record.refs++;
    return () => {
      record.refs--;
    };
  }, [record]);
}

function lookupRecord(resource, cache, input) {
  let key = createCacheKey(resource, input);
  let record = cache.has(key) ? cache.get(key) : null;
  if (!record || isRecordStale(resource, record)) {
    let newRecord = createRecord(resource, input);
    cache.set(key, newRecord);
    return newRecord;
  }
  return record;
}

function cleanupRecord(record) {
  if (record.type === Pending && typeof record.cancel === 'function') {
    record.cancel();
  }
}

function createCacheKey(resource, input) {
  let key = resource.getCacheKey.call(null, input);
  if (typeof key !== 'string' && typeof key !== 'number') {
    throw new Error('Resource key should be serialized');
  }
  return key;
}

function unwrapRecordValue(record) {
  switch (record.type) {
    case Pending:
      let suspender = record.value;
      throw suspender;
    case Rejected:
      let error = record.value;
      throw error;
    case Resolved:
    default:
      let result = record.value;
      return result;
  }
}

function createRecord(resource, input) {
  let record = {
    type: Pending,
    value: null,
    refs: 0,
    updatedAt: 0,
    cancel: null,
  };
  let entity = resource.query.call(null, input);
  if (Array.isArray(entity)) {
    record.cancel = entity[1];
    entity = entity[0];
  }
  if (entity && typeof entity.then === 'function') {
    record.value = entity
      .then(result => updateRecordValue(record, Resolved, result))
      .catch(error => updateRecordValue(record, Rejected, error));
  } else {
    updateRecordValue(record, Resolved, entity);
  }
  return record;
}

function updateRecordValue(record, type, value) {
  return Object.assign(record, { type, value, updatedAt: Date.now() });
}

function isRecordStale(resource, record) {
  return (
    record.type !== Pending &&
    record.refs < 1 &&
    Date.now() - record.updatedAt > resource.maxAge
  );
}

function isRecord(object) {
  return (
    object != null &&
    (object.type === Pending ||
      object.type === Resolved ||
      object.type === Rejected)
  );
}

function identity(value) {
  return value;
}
