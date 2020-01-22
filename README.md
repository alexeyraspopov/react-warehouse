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
  - [Basic data fetching](#basic-data-fetching)
  - [Preloading resources](#preloading-resources)
  - [Controlling max age and cache capacity](#controlling-max-age-and-cache-capacity)
- [API Reference](#api)

## Abilities & Restrictions

What the API can do:

- **Basic co-located data fetching with Suspense**  
  The API covers the most common data fetching use cases, including pagination,
  search results, etc.
- **Render-as-you-fetch approach**  
  The API allows implementing the approach suggested by React team. See more
  in corresponding [section of docs][render-as-you-fetch]
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

## Implementation

_This section describes the logic behind the cache implementation. It is not
mandatory. You can skip it and read [Usage Examples](#usage) and
[API Reference](#api). This section is still in progress, while I'm trying to
make the explanation easier to read and understand._

Cache invalidation is one of the hardest things in programming. What's even
harder is to implement an abstraction that cover all possible cases in product
development. Both user experience and developer experience must be considered.

The idea of this project is to consider data being outdated most of the time.
This is getting closer to the real world in the systems with higher ratio of
user interactions. Every time user opens a screen in single-page app, let's
assume we need to fetch new data, unless there are specific conditions where
cached data can be reused.

**The solution** uses three different strategies for cache invalidation:
[LRU cache][lru-cache], [reference counting][ref-counting], and max-age control.
The combination is defined by a set of UX scenarios that should be supported
without unnecessary overhead for the developer.

When the library performs an async request, the promise is stored in the cache
and the tree is suspended (see [Suspense for Data Fetching][concurrent-suspense]).
If two components trying to access the same data, they will suspend with the
same promise.

When data is resolved, suspended subtree will re-render and cached data will be
used. Once component successfully rendered, it increments a reference count of
the data record it uses. This allows avoiding unnecessary UI flickering when
component is visible for time longer than data's max age. When component is
unmounted (i.e. when user leaves a page), it decrements the data's reference
count. If the component is rendered again, the cache will check max age of
cached data to consider making a new request.

Preloaded queries incrementing reference count too. The data can be preloaded
on page component level and used by some dynamic child section. This UI section
will not attempt making new requests while the page keeps reference to the data.

In order to prevent caches to consume too much memory, they are limited by their
`capacity`. Records in cache are handled by LRU algorithm. If cache needs to
delete a record that is still not resolved, it will also attempt to cancel the
request (see examples below).

## Usage

### Basic data fetching

```javascript
// PokemonResource.js
import { createResource } from 'react-warehouse';

export let Pokemon = createResource({
  query(id) {
    let url = `https://pokeapi.co/api/v2/pokemon/${id}/`;
    return fetch(url).then(response => response.json());
  },
});
```

```javascript
// PokemonInfo.js
import React, { Suspense } from 'react';
import { useQuery } from 'react-warehouse';
import { Pokemon } from './PokemonResource';

export default function PokemonInfoSection() {
  return (
    <article>
      <h2>Pokemon Profiles</h2>
      <Suspense fallback={<p>Loading profile…</p>}>
        <PokemonInfo name="charmander" />
        <PokemonInfo name="bulbasaur" />
        <PokemonInfo name="squirtle" />
      </Suspense>
    </article>
  );
}

function PokemonInfo({ name }) {
  let profile = useQuery(Pokemon, name);
  return (
    <section>
      <p>{profile.name}</p>
      <img src={profile.sprites.front_default} />
    </section>
  );
}
```

### Preloading resources

Suspense documentation [describes][concurrent-suspense] issues related to
requests waterfall. Those are scenarios which are pretty easy to face:

```javascript
import { useQuery } from 'react-warehouse';

function Parent() {
  return (
    <Suspense fallback={<Spinner />}>
      <Child />
    </Suspense>
  );
}

function Child() {
  let dataA = useQuery(ResourceA, '/');
  let dataB = useQuery(ResourceB, 'someId');
  // ...
}
```

Two resource query are not depending on each other and both of them can suspend.
The problem is that we need to wait for the first query to resolve in order to
start querying the second resource. This may lead to downgraded UX.

An additional API allows performing necessary requests before the data is
required for rendering and then suspending the tree only when requests are
not yet finished.

```javascript
import { usePreloadedQuery, useQuery } from 'react-warehouse';

function Parent() {
  // If data is missing, the hook will request it without suspending
  // In this example, requests will be made in parallel.
  usePreloadedQuery(ResourceA, '/');
  usePreloadedQuery(ResourceB, 'someId');
  return (
    <Suspense fallback={<Spinner />}>
      <Child />
    </Suspense>
  );
}

function Child() {
  // If data is still missing by the time this component renders,
  // the tree will be suspended, but without additional requests
  let dataA = useQuery(ResourceA, '/');
  let dataB = useQuery(ResourceB, 'someId');
  // ...
}
```

This particular approach benefits the UX but may introduce issues for DX.
For examples, the data requirement can be removed from child component but
preloaded query will be missed. Or, the input in child component will be
changed, but not in preloading query, which brings waterfall back and
additionally requests unnecessary data.

This is where query refs come into play. They create explicit dependency
between preloading parent and the child components:

```javascript
import { usePreloadedQuery, useQueryRef } from 'react-warehouse';

function Parent() {
  let dataARef = usePreloadedQuery(ResourceA, '/');
  let dataBRef = usePreloadedQuery(ResourceB, 'someId');
  return (
    <Suspense fallback={<Spinner />}>
      <Child dataARef={dataARef} dataBRef={dataBRef} />
    </Suspense>
  );
}

function Child({ dataARef, dataBRef }) {
  let dataA = useQueryRef(dataARef);
  let dataB = useQueryRef(dataBRef);
  // ...
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

Cache capacity makes sure the cache size don't create performance issues for the
application. Modifying it is not necessary in most cases, but there are some
that can take advantage of it.

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
    let request = fetch(url, {
      signal: controller.signal,
    }).then(response => response.json());
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

### `createResource(options)`

This function can be treated as React's `createContext()` function.
Returns `Resource` instance that will be consumed by following hooks.

- `options.query` — function that does the job. Must return a payload, or
  promise of payload, or tuple `[Promise, onCancel]`. See usage examples.
- `options.maxAge` _(optional)_ — Max resource age in milliseconds. Default is `10000`.
- `options.capacity` _(optional)_ — Max cache size allowed. Default is `256`.

### `useResource(Resource, [...deps])`

Returns an instance of resource while preloading data using `query(...deps)`
and caching the result with `Resource`s cache options.

### `useResourceFactory(query, [...deps])`

Returns an instance of resource while preloading data using `query(...deps)`
and keeping the instance as a part of the calling component.

### `useResourceValue(resource)`

Unwraps resource instance's value and suspends if necessary.

### `useQuery(Resource, input)`

Returns data from cache or suspends if no data available or existing record is
stale (based on `maxAge` and reference count). If two components are querying
the same record, they suspend the same promise.

- `resource` — specific resource instance created earlier.
- `input` — an arbitrary input that resource's `query()`.

### `usePreloadedQuery(Resource, input)`

Invokes `query(input)` without suspending the tree if no data is cached and
returns a reference object that can be used in subtree.

- `resource` — specific resource instance created earlier.
- `input` — an arbitrary input that resource's `query()`.

### `useQueryRef(ref)`

Uses reference created by a parent component to either extract preloaded data
or suspend the tree while data is still loading.

- `ref` — a reference created by `usePreloadedQuery()`.

[react-hooks]: https://reactjs.org/docs/hooks-intro.html
[react-suspense]: https://reactjs.org/docs/concurrent-mode-suspense.html
[lru-cache]: https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU)
[ref-counting]: https://en.wikipedia.org/wiki/Reference_counting
[concurrent-suspense]: https://reactjs.org/docs/concurrent-mode-suspense.html
[render-as-you-fetch]: https://reactjs.org/docs/concurrent-mode-suspense.html#approach-3-render-as-you-fetch-using-suspense
