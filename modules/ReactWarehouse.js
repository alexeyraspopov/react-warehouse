import {
  createContext,
  useContext,
  useDebugValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import LRUCache from './LRUCache';
import hashCode from './hashCode';

let Pending = 0;
let Resolved = 1;
let Rejected = 2;

let Registry = createContext(new Map());

let ResourcePrototype = {
  query: null,
  maxAge: 10000,
  capacity: 256,
};

export function createResource(options) {
  return Object.assign({}, ResourcePrototype, options);
}

export function useResource(Resource, deps) {
  let resource = useResourceLookup(Resource, deps);
  useResourceLock(resource);
  useDebugValue(resource);
  return resource;
}

export function useResourceFactory(query, deps) {
  let resource = useResourceMemo(query, deps);
  useResourceCleanup(resource);
  useDebugValue(resource);
  return resource;
}

export function useResourceFlow(Resource, deps) {
  let resource = useResourceLookup(Resource, deps);
  let state = useResourcePendingState(resource);
  useResourceLock(state[0]);
  useDebugValue(state);
  return state;
}

export function useResourceSync(Resource, deps) {
  let resource = useResourceLookup(Resource, deps);
  let value = unwrapResourceValue(resource);
  useResourceLock(resource);
  useDebugValue(value);
  return value;
}

export function useResourceValue(resource) {
  let value = unwrapResourceValue(resource);
  useDebugValue(value);
  return value;
}

function useResourceLookup(Resource, deps) {
  let cache = useResourceCache(Resource);
  let key = createCacheKey(Resource, deps);
  let resource = cache.has(key) ? cache.get(key) : null;
  if (resource == null || isResourceStale(Resource, resource)) {
    let newResource = createResourceInstance(key);
    let entity = getPendingEntity(Resource.query, deps);
    updateResourceWithEntity(newResource, entity);
    cache.set(key, newResource);
    return newResource;
  }
  return resource;
}

function useResourceCache(Resource) {
  let registry = useContext(Registry);
  if (registry.has(Resource)) {
    return registry.get(Resource);
  }
  let cache = LRUCache(Resource.capacity, cleanupResource);
  registry.set(Resource, cache);
  return cache;
}

function useResourcePendingState(resource) {
  let [state, setState] = useState([resource, false]);
  let current = state[0];
  useEffect(() => {
    if (current === resource) {
      return noop;
    } else if (resource.type === Pending) {
      setState([current, true]);
      return subscribe(resource.value, () => {
        setState([resource, false]);
      });
    } else {
      setState([resource, false]);
      return noop;
    }
  }, [current, resource]);
  return state;
}

function useResourceLock(resource) {
  useEffect(() => {
    resource.refs += 1;
    return () => {
      resource.refs -= 1;
    };
  }, [resource]);
}

function createCacheKey(Resource, deps) {
  return deps.length > 0
    ? deps.map((item) => hashCode(item)).join('/')
    : hashCode(Resource);
}

function isResourceStale(Resource, resource) {
  return (
    resource.type !== Pending &&
    resource.refs < 1 &&
    Date.now() - resource.updatedAt > Resource.maxAge
  );
}

function useResourceMemo(query, deps) {
  return useMemo(() => {
    let resource = createResourceInstance(null);
    let entity = getPendingEntity(query, deps);
    updateResourceWithEntity(resource, entity);
    return resource;
  }, deps);
}

function useResourceCleanup(resource) {
  useEffect(() => {
    return () => {
      cleanupResource(resource);
    };
  }, [resource]);
}

function unwrapResourceValue(resource) {
  switch (resource.type) {
    case Pending:
      let suspender = resource.value;
      throw suspender;
    case Resolved:
      let value = resource.value;
      return value;
    case Rejected:
      let error = resource.value;
      throw error;
  }
}

function cleanupResource(resource) {
  if (resource.type === Pending) {
    resource.cancel.call(null);
  }
}

function createResourceInstance(key) {
  return {
    key: key,
    type: Pending,
    value: null,
    refs: 0,
    updatedAt: 0,
    cancel: noop,
  };
}

function getPendingEntity(fn, deps) {
  let result = fn.apply(null, deps);
  let entity = Array.isArray(result) ? result : [result, noop];
  return entity;
}

function updateResourceWithEntity(resource, [value, cancel]) {
  resource.cancel = cancel;
  if (value && typeof value.then === 'function') {
    let resolve = (result) => updateResourceValue(resource, Resolved, result);
    let reject = (error) => updateResourceValue(resource, Rejected, error);
    updateResourceValue(resource, Pending, value.then(resolve, reject));
  } else {
    updateResourceValue(resource, Resolved, value);
  }
}

function updateResourceValue(resource, type, value) {
  return Object.assign(resource, { type, value, updatedAt: Date.now() });
}

function subscribe(suspender, callback) {
  let open = true;
  let emit = () => (open ? callback() : null);
  suspender.then(emit, emit);
  return () => {
    open = false;
  };
}

function noop() {}
