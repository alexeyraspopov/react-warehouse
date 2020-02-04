export as namespace ReactWarehouse;
import { Component, Node } from 'react';

export type ResourceCache<Data, Deps> = {};

export type Resource<Data> = {};

export type ResourceQuery<Data> =
  | Data
  | Promise<Data>
  | [Promise<Data>, () => void];

type QueryFunction<Data, Deps> = (...deps: Deps) => ResourceQuery<Data>;

type ResourceOptions<Data, Deps> = {
  query: QueryFunction<Data, Deps>;
  maxAge?: number;
  capacity?: number;
};

export function createResource<Data, Deps>(
  options: ResourceOptions<Data, Deps>,
): ResourceCache<Data, Deps>;

export function useResource<Data, Deps>(
  Resource: ResourceCache<Data, Deps>,
  deps: Deps,
): Resource<Data>;

export function useResourceFactory<Data, Deps>(
  query: QueryFunction<Data, Deps>,
  deps: Deps,
): Resource<Data>;

export function useResourceFlow<Data, Deps>(
  Resource: ResourceCache<Data, Deps>,
  deps: Deps,
): [Resource<Data>, boolean];

export function useResourceSync<Data, Deps>(
  Resource: ResourceCache<Data, Deps>,
  deps: Deps,
): Data;

export function useResourceValue<Data>(resource: Resource<Data>): Data;

export var ErrorBoundary: Component<{
  fallback: Node;
  onError?: (error: any) => void;
}>;
