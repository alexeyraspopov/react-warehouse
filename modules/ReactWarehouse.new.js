import {
  createContext,
  useContext,
  useCallback,
  useDebugValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSubscription } from 'use-subscription';
import Signal from './Signal.new';
import AsyncSignal from './AsyncSignal.new';
import hashCode from './hashCode';
import LRUCache from './LRUCache';
import noop from './noop';

let EMPTY_VALUE = Symbol('EMPTY_VALUE');

let Registry = createContext(new Map());

export function experimental_useResource(Resource, deps) {
  let ResourceRef = useLatestRef(Resource);
  let depsRef = useLatestRef(deps);
  let storage = useResourceStorage(Resource);
  let resource$ = useMemo(() => {
    let signal = new Signal();
    let ctl = {
      signal,
      pending: signal,
      get value() {
        let current = this.currentRecord;
        return current !== null ? current.value : EMPTY_VALUE;
      },
      currentKey: null,
      currentRecord: null,
      publish() {
        let Resource = ResourceRef.current;
        let deps = depsRef.current;
        let key = createCacheKey(Resource, deps);
        ctl.currentKey = key;
        lookupRecord(
          key,
          storage.cache,
          (record) => storage.signal.publish(record),
          () => Resource.query(...deps),
          Resource,
        );
      },
      set(data) {
        updateRecordValue(
          ctl.currentKey,
          storage.cache,
          (record) => storage.signal.publish(record),
          // TODO make use of Resource.mutate()
          data,
        );
      },
      retry() {
        let Resource = ResourceRef.current;
        let deps = depsRef.current;
        let key = createCacheKey(Resource, deps);
        ctl.currentKey = key;
        retryRecord(
          key,
          storage.cache,
          (record) => storage.signal.publish(record),
          () => Resource.query(...deps),
        );
      },
      dispose() {
        if (ctl.currentRecord !== null) {
          ctl.currentRecord.refs -= 1;
        }
        subscription.dispose();
      },
      _isPending: false,
      isPending() {
        return ctl._isPending;
      },
    };
    let subscription = storage.signal.subscribe((record) => {
      if (record.key === ctl.currentKey) {
        if (ctl.value !== EMPTY_VALUE && record.value === EMPTY_VALUE) {
          // if current resource is resolved and new record is suspensful,
          // resource keeps existing resolved record until awaited record is resolved
          ctl._isPending = true;
        } else {
          // otherwise, count refs and update current resource value
          if (ctl.currentRecord !== null) {
            ctl.currentRecord.refs -= 1;
          }
          record.refs += 1;
          ctl.currentRecord = record;
          ctl._isPending = record.pending;
        }

        ctl.signal.publish();
      }
    });
    return ctl;
  }, [storage]);

  // useMemo is being used as a sync way to react to `deps` changes without revalidating whole controller
  useMemo(() => resource$.publish(deps), deps);
  // Whatever happens in the resource controller at the time should be cancelled and subscriptions disposed
  useEffect(() => () => resource$.dispose(), [resource$]);

  return resource$;
}

export function experimental_useResourceFactory(query, deps) {
  let queryRef = useLatestRef(query);
  let resource$ = useMemo(() => {
    let signal = new AsyncSignal();
    let pending = new Signal();
    let ctl = {
      signal,
      pending,
      value: EMPTY_VALUE,
      publish() {
        signal.publish(queryRef.current);
        pending.publish();
      },
      set(data) {
        signal.publish(data);
        pending.publish();
      },
      retry() {
        ctl.publish();
      },
      dispose() {
        signal.current.cancel();
      },
      isPending() {
        return ctl.value !== EMPTY_VALUE && signal.current.id !== null;
      },
    };
    signal.subscribe((value) => {
      ctl.value = value;
      pending.publish();
    });
    return ctl;
  }, []);

  // useMemo is being used as a sync way to react to `deps` changes without revalidating whole controller
  useMemo(() => resource$.publish(deps), deps);
  // Whatever happens in the resource controller at the time should be cancelled and subscriptions disposed
  useEffect(() => () => resource$.dispose(), [resource$]);

  useDebugValue(resource$);
  return resource$;
}

function useResourceStorage(Resource) {
  let registry = useContext(Registry);
  if (registry.has(Resource)) {
    return registry.get(Resource);
  }
  let cache = LRUCache(Resource.capacity, cleanupRecord);
  let signal = new Signal();
  let storage = { cache, signal };
  registry.set(Resource, storage);
  return storage;
}

export function experimental_useResourceRetryCallback(resource$) {
  return useCallback(() => resource$.retry(), [resource$]);
}

export function experimental_useResourcePendingState(resource$) {
  let pending = useSignalSubscription(() => resource$.isPending(), resource$.pending);
  useDebugValue(pending);
  return pending;
}

export function experimental_useResourceValue(resource$) {
  let value = useSignalSubscription(() => unwrapResourceValue(resource$), resource$.signal);
  useDebugValue(value);
  return value;
}

export function experimental_useResourceState(resource$) {
  let value = useSignalSubscription(() => unwrapResourceValue(resource$), resource$.signal);
  let dispatch = useCallback((data) => resource$.set(data), [resource$]);
  let state = [value, dispatch];
  useDebugValue(state);
  return state;
}

function useSignalSubscription(getCurrentValue, signal) {
  let subscription = useMemo(() => {
    return {
      getCurrentValue,
      subscribe: (callback) => {
        let subscription = signal.subscribe(callback);
        return () => subscription.dispose();
      },
    };
  }, [signal]);
  let value = useSubscription(subscription);
  return value;
}

function unwrapResourceValue(resource$) {
  if (resource$.value === EMPTY_VALUE) {
    throw new Promise((resolve) => {
      let subscription = resource$.signal.subscribe(() => {
        subscription.dispose();
        resolve();
      });
    });
  }

  if (resource$.value instanceof Error) {
    throw resource$.value;
  }

  return resource$.value;
}

function useLatestRef(data) {
  let ref = useRef();
  ref.current = data;
  return ref;
}

function createCacheKey(Resource, deps) {
  return deps.length > 0 ? deps.map((item) => hashCode(item)).join('/') : hashCode(Resource);
}

function lookupRecord(key, cache, onLookup, onQuery, Resource) {
  let record = cache.has(key) ? cache.get(key) : null;
  if (record === null) {
    record = createRecordInstance(key);
    cache.set(key, record);
    queryRecord(record, onQuery, onLookup);
  } else if (isRecordStale(Resource, record)) {
    queryRecord(record, onQuery, onLookup);
    if (isRecordSwr(Resource, record)) {
      record.pending = true;
    } else {
      record.value = EMPTY_VALUE;
    }
  }

  onLookup(record);
}

function retryRecord(key, cache, onRetry, onQuery) {
  let record = cache.has(key) ? cache.get(key) : null;

  if (record === null) {
    // QUESTION is it possible?
    // wont be possible if controller would hold whole record by itself and reference it
  } else {
    cleanupRecord(record);
    queryRecord(record, onQuery, onRetry);
    record.pending = true;
    onRetry(record);
  }
}

function updateRecordValue(key, cache, onUpdate, data) {
  let record = cache.has(key) ? cache.get(key) : null;

  if (record === null) {
    // QUESTION is it possible?
  } else {
    cleanupRecord(record);
    record.value = data;
    record.updatedAt = Date.now();
    record.pending = false;
  }

  onUpdate(record);
}

function queryRecord(record, onQuery, onUpdate) {
  let taskId = Math.random();
  let update = (result) => {
    if (record.taskId === taskId) {
      record.value = result;
      record.updatedAt = Date.now();
      record.pending = false;
      onUpdate(record);
    }
  };
  let result = onQuery();
  let [promise, onCancel] = Array.isArray(result) ? result : [result, noop];

  promise.then(update).catch(update);

  record.taskId = taskId;
  record.cancel = onCancel;
}

function createRecordInstance(key) {
  return {
    key: key,
    value: EMPTY_VALUE,
    refs: 0,
    updatedAt: 0,
    cancel: noop,
    pending: false,
    taskId: null,
  };
}

function cleanupRecord(record) {
  if (isRecordPending(record)) {
    record.taskId = null;
    record.cancel();
  }
}

function isRecordPending(record) {
  return record.value === EMPTY_VALUE || record.pending;
}

function isRecordStale(Resource, record) {
  return (
    !isRecordPending(record) && record.refs < 1 && Date.now() - record.updatedAt > Resource.maxAge
  );
}

function isRecordSwr(Resource, record) {
  return Date.now() - record.updatedAt - Resource.maxAge < Resource.staleAge;
}
