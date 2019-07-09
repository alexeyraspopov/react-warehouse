# React Warehouse

    npm install react-warehouse

An _experimental_ implementation of data cache and resource loaders that works
with React Suspense.

The implementation is based on [React Hooks](https://reactjs.org/docs/hooks-intro.html).

## Motivation

While `react-cache` is in development, I'd like to experiment with the ability
to fetch data seamlessly in function components and to use `<Suspense />` for
managing the page appearance during the loading phase. During my work I've
observed a bunch of potential issues and edge cases that I'm aiming at covering
by this implementation.

In current state, `react-cache` is not ready for production as stated by the
development team and only works with LRU cache invalidation strategy. It may
not fit your needs and make invalidation quite hard. At very least, it didn't
work for my cases.

As a part of `react-cache` implementation, the development team attempts to
solve a class of problems with managing external state (see [RFC][write-rfc]).
The proposed implementation covers more than just loading data in components.
It requires more consideration due to concurrent mode support, multiple roots
support, etc.

My initial attempt to implement IO data caching layer was based on replicating
`react-cache` functionality. However, instead of keeping the global instance of
cache, I've attempted to make a primitive state management using context's
provider as a root of cache. It provides additional flexibility since you can
manage cache's lifecycle by managing the tree (i.e. cache is cleared once the
user leaves the page).

However, the cache provider component has its downsides. It requires additional
decision and action to be made once a part of the tree introduces async data
fetching. Sometimes you may need to have different cache boundaries on a single
page when using a variety of resources.

**The solution** uses two different strategies for cache invalidation: reference
counting and max age control. It allows to avoid using the provider component.
The combination is defined by a set of scenarios that should be supported
without unnecessary overhead for the developer.

<data is often inconsistent due to multi user apps>

Instead of requiring to write additional imperative logic to invalidate cache of
a generic resource, the idea of proposed implementation is to invalidate cache
"whenever is possible", meaning, whenever the fetched data is no longer used by
the component that requested it. This means, cache is not invalidated between
re-renders (obviously) but it is invalidated once the user leaves the section
(switches tabs, leaves the page, anything that completely destroy the piece of
UI with fetched data). If more than one component requires the same data, it
will be invalidated only when all those components are gone.

Given such scenario, there are also cases where you'd like to avoid additional
requests when, for example, data is not getting updated that often or the user
may switch between page too quickly so there won't be a reason to re-fetch the
same data. This is where max age control comes into play. Additionally, it
allows to keep some immutable data in cache for longer time.

## Plans

A part of the experiment is to implement enough abstraction to work with async
data in the way that is close to managing a simple piece of local state.
The ideal state is to be able to manage a collection of data with all necessary
operations (create, retrieve, update, destroy) without thinking much about
required side effects such as HTTP requests or cache invalidation.

## API

    let Resource = createResource(options)

Creates an instance that handles resource's cache.

    let entity = useDocument(resource, key, loader)

Reads from resource's cache or calls the fetch function.

[write-rfc]: https://github.com/acdlite/rfcs/blob/context-write/text/0000-context-write.md
