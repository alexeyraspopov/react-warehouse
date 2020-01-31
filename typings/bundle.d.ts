export as namespace ReactWarehouse;
import { Component, Node } from 'react';

export type ResourceCache<T, D> = {};

export type Resource<T> = {};

export type ResourceQuery<T> = T | Promise<T> | [Promise<T>, () => void];

type QueryFunction<T, D> = (...deps: D) => ResourceQuery<T>;

type ResourceOptions<T, D> = {
  query: QueryFunction<T, D>;
  maxAge?: number;
  capacity?: number;
};

export function createResource<T, D>(
  options: ResourceOptions<T, D>,
): ResourceCache<T, D>;

export function useResource<T, D>(
  Resource: ResourceCache<T, D>,
  deps: D,
): Resource<T>;

export function useResourceFactory<T, D>(
  query: QueryFunction<T, D>,
  deps: D,
): Resource<T>;

export function useResourceFlow<T, D>(
  Resource: ResourceCache<T, D>,
  deps: D,
): [Resource<T>, boolean];

export function useResourceSync<T, D>(
  Resource: ResourceCache<T, D>,
  deps: D,
): T;

export function useResourceValue<T>(resource: Resource<T>): T;

export var ErrorBoundary: Component<{
  fallback: Node;
  onError?: (error: any) => void;
}>;