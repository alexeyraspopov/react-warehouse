# React Warehouse

    npm install react-warehouse

An _experimental_ implementation of data cache and resource loaders that works
with React Suspense.

The package provides basic [React Hooks][react-hooks] to create resource, load
and preload its entities.

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

## Implementation

**The solution** uses two different strategies for cache invalidation: reference
counting and max age control. It allows to avoid using the provider component.
The combination is defined by a set of scenarios that should be supported
without unnecessary overhead for the developer.

Cache invalidation is one of the hardest things in programming. What's even
harder is to implement an abstraction that cover all possible cases in product
development. This is why libraries can be too abstract and flexible but using
them require significant effort.

The idea of this experiment is to consider data outdated most of the time.
This is getting closer to the real world in the systems with higher ratio of
user interactions. Every time user opens a screen in single-page app, let's
assume we need to fetch the data. Most likely, the data we fetched before is
already outdated.

Most data-related libraries in React world are designed around scenario where
developers describe the flow of manually saving data received from 3rd party
source. When it comes to invalidating the cache, you're all by yourself.
This solution allows developers to _only_ define the way to read data from
external data sources.

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

## Restrictions

What the API can do:

 * **Basic one-time data fetching**
   The API covers a small amount of data handling cases, but these cases are
   the most frequent in modern web app development.
 * **Reduced screen flickering**.
   Age control strategy makes sure the data is not re-fetched any time you need
   to render it. Leaving the page and going back to it quickly may show
   previously fetched data if it's not too old.

What the API _cannot do_:

 * **Server-side rendering**
   Suspense is not yet supported in SSR. After `react-dom` starts support the
   feature, some additional changes may be required to make the solution work
   properly.
 * **Manual cache invalidation**
   I'm trying to figure the semantics. In order to keep the solution small and
   focused, I'm looking for a proper level of abstraction that needs to be
   implemented.

## Plans

A part of the experiment is to implement enough abstraction to work with async
data in the way that is close to managing a simple piece of local state.
The ideal state is to be able to manage a collection of data with all necessary
operations (create, retrieve, update, destroy) without thinking much about
required side effects such as HTTP requests or cache invalidation.

## Usage

As an example, let's build a user profile page. We need to fetch data from some
API endpoint based on user's ID, show a loading spinner while waiting for the
data, then render the info.

Let's assume we have some function that makes an API call:

```javascript
// UserResource.js
async function fetchUserProfile(userId) {
  let response = await fetch(`/api/users/${userId}`);
  let payload = await response.json();
  return payload;
}
```

We use this function to define the resource that we're dealing with:

```javascript
// UserResource.js
import { createResource } from 'react-warehouse';

let User = createResource(fetchUserProfile);
```

In the same file we can specify a custom hook, so that we won't need to bring
implementation details to the UI level:

```javascript
// UserResource.js
import { useResourceQuery } from 'react-warehouse';

export function useUserProfile(userId) {
  let profile = useResourceQuery(User, userId);
  return profile;
}
```

And we're good to go. Let's make a quick page for the user profiles

```javascript
// UserProfilePage.js
import React from 'react';
import { useUserProfile } from './UserResource';

export default function UserProfilePage({ userId }) {
  return (
    <article>
      <h2>User Profile</h2>
      <Suspense fallback={<p>Loading profile…</p>}>
        <UserProfile userId={userId} />
      </Suspense>
    </article>
  );
}

function UserProfile({ userId }) {
  let profile = useUserProfile(userId);
  return (
    <section>
      <h3>{profile.name} Profile</h3>
      <p>{profile.bio}</p>
    </section>
  );
}
```

## API

    let Resource = createResource(fetcherFn[, maxAge]);

Creates an instance that handles resource's cache.

    let entity = useResourceQuery(Resource, key);

Reads from resource's cache or calls the fetch function.

    useResourcePreload(Resource, key);

Checks the cache and invokes the fetch function without suspending the tree.

[react-hooks]: https://reactjs.org/docs/hooks-intro.html
[write-rfc]: https://github.com/acdlite/rfcs/blob/context-write/text/0000-context-write.md
