# Architecture

_This document is in progress_

## Implementation

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

When the library performs an async request, the pending promise is stored in
the cache and the tree is suspended (see [Suspense for Data Fetching][concurrent-suspense]).
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

[lru-cache]: https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU)
[ref-counting]: https://en.wikipedia.org/wiki/Reference_counting
[concurrent-suspense]: https://reactjs.org/docs/concurrent-mode-suspense.html
