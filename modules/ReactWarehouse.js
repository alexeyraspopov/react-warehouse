import { createContext, useContext, useEffect, useDebugValue } from 'react';

let Pending = 0;
let Resolved = 1;
let Rejected = 2;

let Registry = createContext(new Map());

export function createResource(load, maxAge = 10000) {
  let resource = { load, maxAge };
  return resource;
}

export function useResourceQuery(resource, key) {
  let cache = useRecordCache(resource);
  let record = lookupRecord(resource, cache, key);
  let value = unwrapRecordValue(record);
  useRecordLock(record);
  useDebugValue(value);
  return value;
}

export function useResourcePreload(resource, key) {
  let cache = useRecordCache(resource);
  let record = lookupRecord(resource, cache, key);
  useRecordLock(record);
  useDebugValue(record);
}

function useRecordCache(resource) {
  let registry = useContext(Registry);
  if (registry.has(resource)) {
    return registry.get(resource);
  }
  let cache = new Map();
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

function lookupRecord(resource, cache, key) {
  let record = cache.has(key) ? cache.get(key) : null;
  if (!record || isRecordStale(resource, record)) {
    let newRecord = createRecord(resource, key);
    cache.set(key, newRecord);
    return newRecord;
  }
  return record;
}

function unwrapRecordValue(record) {
  switch (record.type) {
    case Pending:
    case Rejected:
      throw record.value;
    case Resolved:
      return record.value;
  }
}

function createRecord(resource, key) {
  let record = { type: Pending, value: null, refs: 0, updatedAt: 0 };
  record.value = resource
    .load(key)
    .then(value => updateRecordValue(record, Resolved, value))
    .catch(error => updateRecordValue(record, Rejected, error));
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
