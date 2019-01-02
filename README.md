# React Warehouse

    npm install react-warehouse

An _experimental_ implementation of data cache and resource loaders that works
with React Suspense.

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

## API

    createResource(asyncLoadingFunction)

Creates an instance that handles resource's cache.

    Resource.read(resourceKey)

Reads from resource's cache or calls the fetch function.

    Resource.preload(resourceKey)

Calls the fetch function on the background if no cache available.

[write-rfc]: https://github.com/acdlite/rfcs/blob/context-write/text/0000-context-write.md
