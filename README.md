# React Warehouse

An _experimental_ implementation of data cache and resource loaders that works
with React Suspense.

## Motivation

While `react-cache` is in development, I'd like to experiment with the ability
to fetch data seamlessly in function components and to use `<Suspense />` for
managing the page appearance during the loading phase. During my work I've
observed a bunch of potential issues and edge cases that I'm aiming at covering
by this implementation.
