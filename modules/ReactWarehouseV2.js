import { useDebugValue, useEffect, useMemo } from 'react';

let Pending = 0;
let Resolved = 1;
let Rejected = 2;

export function createResource(options) {}

export function useResource(Resource, deps) {}

export function useResourceFactory(query, deps) {
  let resource = useResourceMemo(query, deps);
  useResourceCleanup(resource);
  useDebugValue(resource);
  return resource;
}

export function useResourceValue(resource) {
  let value = unwrapResourceValue(resource);
  useDebugValue(value);
  return value;
}

function useResourceMemo(query, deps) {
  return useMemo(() => {
    let resource = createResourceInstance();
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

function createResourceInstance() {
  return {
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
    resource.value = value
      .then(result => updateResourceValue(resource, Resolved, result))
      .catch(error => updateResourceValue(resource, Rejected, error));
  } else {
    updateResourceValue(resource, Resolved, value);
  }
}

function updateResourceValue(resource, type, value) {
  return Object.assign(resource, { type, value, updatedAt: Date.now() });
}

function noop() {}
