# React Warehouse

    npm install react-warehouse

The package provides necessary [React Hooks][react-hooks] to create resource,
load and preload its entities using [React Suspense][react-suspense] (in both
legacy and concurrent mode). The implementation attempts to invalidate stale
data and keep things up to date without additional effort from developers and
without sacrificing user experience.

- [Abilities & Restrictions](#abilities--restrictions)
- [Implementation Details](#implementation)
- [Usage Examples & Recipes](#usage)
  - [Render as you fetch](#render-as-you-fetch)
  - [Local-first & Refactoring-friendly](#local-first--refactoring-friendly)
  - [Opt-in waterfall requests](#opt-in-waterfall-requests)
  - [Controlling max age and cache capacity](#controlling-max-age-and-cache-capacity)
- [API Reference](#api-reference)
- [Typings](#typings)

## Abilities & Restrictions

What the API can do:

- **Basic co-located data fetching with Suspense**  
  The API covers the most common data fetching use cases, including pagination,
  search results, etc.
- **Render-as-you-fetch approach**  
  The API allows implementing the approach suggested by React team. See more
  in corresponding [section of docs][render-as-you-fetch].
- **Request cancellation**  
  When a cancel handler is available, the lib will attempt to use it whenever
  it's possible. Currently, Suspense has some limitations, but there are cases
  where redundant requests can be cancelled nevertheless.

What the API _cannot do_ at the moment:

- **Server-side rendering**  
  Suspense is not yet supported in SSR. After `react-dom` starts support
  the feature, some additional changes may (or may not) be required to make
  the solution work properly.
- **Manual cache invalidation**  
  I'm trying to figure the semantics. In order to keep the solution small
  and focused, I'm looking for a proper level of abstraction that needs
  to be implemented.

Things on the roadmap:

- **Controlled mutations**  
  There has to be a piece of API that allows a way to perform async mutation
  along with updating the cache.

## Usage

### Render as you fetch

_To be defined_

### Local-first & Refactoring-friendly

_To be defined_

### Opt-in waterfall requests

If a component requires data queried from different sources where one piece
depends on another, you can bypass "render as you fetch" pattern and request
data directly where it's going to be used.

Note: `useResourceSync()` only works with pre-defined resources since it can't
rely on the component's state.

```javascript
import { useResourceValue, useResourceSync } from 'react-warehouse';

function FriendList({ user$ }) {
  let user = useResourceValue(user$);
  let friends = useResourceSync(FriendsResource, [user.id]);
  return (
    <section>
      {friends.map(friend => ...)}
    </section>
  );
}
```

### Controlling max age and cache capacity

There are plenty of cases where you may know specific max age for data, or even
consider some data immutable. Max age handling becomes important when users
keep long living tabs with your application and keep using them without reloading.

For example, it is safe to assume that employees list is not updating too often,
so we can avoid unnecessary requests by keeping data for at least 12 hours.

```javascript
let Employees = createResource({
  query() { ... },
  maxAge: 12 * 60 * 60 * 1000,
});
```

Some pieces of data may be considered immutable in real world, which means we
can avoid invalidating it based on age therefore reducing page flickering.

```javascript
let PokemonAbilities = createResource({
  query(id) { ... },
  maxAge: Infinity,
});
```

Cache capacity makes sure the cache size don't create performance and memory
issues for the application. Modifying it is not necessary in most cases, but
there are some that can take advantage of it.

For example, when performing real time search request, we can set `capacity: 1`
which means we only need the latest result of the search saved. So whenever
users type slowly and producing intermediate requests, the resource can cancel
them and remove from the cache.

```javascript
let UserSearch = createResource({
  query(searchString) {
    let url = `/api/users?query=${searchString}`;
    let controller = new AbortController();
    let onCancel = () => controller.abort();
    let request = fetch(url, { signal: controller.signal }).then((response) => response.json());
    return [request, onCancel];
  },
  capacity: 1,
});
```

When user goes through pages of content, they only see a single page. However,
they may need to "go back to previous page" so it would be better to keep it
for at least some time.

When they click through pages quickly, we don't need to process all requests,
so clicking 6 times on "next page" really fast, will produce 6 requests, but 3
of them will be cancelled based on capacity.

## API Reference

The API designed in the way that does not require specific non-local changes.
The hooks can be added to existing components without refactoring the whole
implementation.

### `createResource(options)`

This function can be treated as React's `createContext()` function.
Returns `Resource` instance that will be consumed by following hooks.

- `options.query` — function that does the job. Must return a payload, or
  promise of payload, or tuple `[Promise, onCancel]`. See usage examples.
- `options.mutate` _(optional)_ — function that describes arbitrary mutations
  and returns a new resource value that will be saved in cache.
- `options.maxAge` _(optional)_ — Max resource age in milliseconds. Default is `10000`.
- `options.capacity` _(optional)_ — Max cache size allowed. Default is `256`.

### `useResource(Resource, [...deps])`

Returns an instance of resource while preloading data using `query(...deps)`
and caching the result with `Resource`s cache options.

### `useResourceFactory(query, [...deps])`

Returns an instance of resource while preloading data using `query(...deps)`
and keeping the instance as a part of the calling component.

### `useResourceFlow(Resource, [...deps])`

Returns a pair of `[resource, isPending]` where `resource` is the same as from
`useResource()` and `isPending` is a boolean flag which turns `true` for any
subsequent request after the first request is resolved.

### `useResourceValue(resource)`

Unwraps resource instance's value and suspends if necessary.

### `useResourceSync(Resource, [...deps])`

A composition of `useResource()` and `useResourceValue()` that allows suspending
in the component which makes use of the resolved data. Suitable when waterfall
is needed.

### `useResourceMutation(Resource, resource)`

Provides a callback that uses `Resource.mutate()` function to update `resource`
value and cache.

### `<ErrorBoundary fallback={...} onError={...} />`

An optional implementation of [Error Boundary][error-boundary]. When not used,
will be tree-shaked out of the bundle.

## Typings

The project includes typings for both Flow and TypeScript without requiring
installation of additional packages. Most of the types working under the hood
providing developer experience benefits. There two types that can be used for
annotating resource's query function and components props.

_It is recommended to provide explicit type annotation to `query()` functions._

### `type ResourceQuery<Data>`

A union type of variants that `query()` can return. The usage is optional since
specific result type can be specified instead.

```javascript
import { createResource } from 'react-warehouse';
// type ResourceQuery<Data> = Promise<Data> | [Promise<Data>, () => void]
import type { ResourceQuery } from 'react-warehouse';

type User = { id: string, fullName: string };

let UserInfo = createResource({
  query(userId: string): ResourceQuery<User> {
    return ...;
  },
});
```

### `type Resource<Data>`

Represents a resource instance that is passed from parent component to child
that later suspends. The usage is optional since necessary hooks are typed.
Explicit usage is needed when a component's annotation is required.

```javascript
import { useResourceValue } from 'react-warehouse';
import type { Resource } from 'react-warehouse';

type User = { id: string, fullName: string };
type Props = { user$: Resource<User> };

export function UserInfoView({ user$ }: Props) {
  let user = useResourceValue(user$);
  return ...;
}
```

[react-hooks]: https://reactjs.org/docs/hooks-intro.html
[react-suspense]: https://reactjs.org/docs/concurrent-mode-suspense.html
[lru-cache]: https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU)
[ref-counting]: https://en.wikipedia.org/wiki/Reference_counting
[concurrent-suspense]: https://reactjs.org/docs/concurrent-mode-suspense.html
[render-as-you-fetch]: https://reactjs.org/docs/concurrent-mode-suspense.html#approach-3-render-as-you-fetch-using-suspense
[error-boundary]: https://reactjs.org/docs/error-boundaries.html
