export as namespace ReactWarehouse;
import { Node, Component } from 'react';

export type ResourceCache<Data, Deps, Vars> = {};

export type Resource<Data> = {};

export type ResourceQuery<Data> = Promise<Data> | [Promise<Data>, () => void];

export type ResourceMutation<ResourceCache> = Function;

type QueryFunction<Data, Deps> = (...deps: Deps) => ResourceQuery<Data>;
type MutateFunction<Data, Vars> = (...vars: Vars) => ResourceQuery<Data>;

type ResourceOptions<Data, Deps, Vars> =
  | {
      query: QueryFunction<Data, Deps>;
      maxAge?: number;
      staleAge?: number;
      capacity?: number;
    }
  | {
      query: QueryFunction<Data, Deps>;
      mutate: MutateFunction<Data, Vars>;
      maxAge?: number;
      staleAge?: number;
      capacity?: number;
    };

export function createResource<Data, Deps, Vars>(
  options: ResourceOptions<Data, Deps, Vars>,
): ResourceCache<Data, Deps, Vars>;

export function useResource<Data, Deps>(
  Resource: ResourceCache<Data, Deps, *>,
  deps: Deps,
): Resource<Data>;

export function experimental_useResource<Data, Deps>(
  Resource: ResourceCache<Data, Deps, *>,
  deps: Deps,
): Resource<Data>;

export function useResourceFactory<Data, Deps>(
  query: QueryFunction<Data, Deps>,
  deps: Deps,
): Resource<Data>;

export function experimental_useResourceFactory<Data, Deps>(
  query: QueryFunction<Data, Deps>,
  deps: Deps,
): Resource<Data>;

export function useResourceFlow<Data, Deps>(
  Resource: ResourceCache<Data, Deps, *>,
  deps: Deps,
): [Resource<Data>, boolean];

export function useResourceSync<Data, Deps>(
  Resource: ResourceCache<Data, Deps, *>,
  deps: Deps,
): Data;

export function experimental_useResourceSync<Data, Deps>(
  Resource: ResourceCache<Data, Deps, *>,
  deps: Deps,
): Data;

export function useResourceMutation<Data, Vars>(
  Resource: ResourceCache<Data, *, Vars>,
  resource: Resource<Data>,
): MutateFunction<Data, Vars>;

export function useResourceValue<Data>(resource: Resource<Data>): Data;

export function experimental_useResourceValue<Data>(resource: Resource<Data>): Data;

export function experimental_useResourceState<Data>(
  resource: Resource<Data>,
): [Data, (Data) => void];

export function experimental_useResourcePendingState<Data>(resource: Resource<Data>): boolean;

export function experimental_useResourceRetryCallback<Data>(resource: Resource<Data>): () => void;

type ErrorBoundaryProps = {
  fallback: Node;
  children: Node;
  onError?: (error: any) => void;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps> {}
