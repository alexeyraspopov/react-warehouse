import React, { Fragment, Suspense, useState } from 'react';
import { createResource, useResourceSync } from 'react-warehouse';
import {
  BrowserRouter,
  Switch,
  Route,
  NavLink,
  useParams,
} from 'react-router-dom';
import Img from './Img';

export default function App() {
  return (
    <BrowserRouter>
      <article className="pokedex-grid">
        <PokemonListSection />
        <PokemonProfileSection />
      </article>
    </BrowserRouter>
  );
}

let Pokemons = createResource({
  query(offset, limit) {
    let url = `https://pokeapi.co/api/v2/pokemon/?offset=${offset}&limit=${limit}`;
    let controller = new AbortController();
    let response = fetch(url, { signal: controller.signal })
      .then(response => response.json())
      .then(response => response.results);
    let onCancel = () => controller.abort();
    return [response, onCancel];
  },
  capacity: 3,
  maxAge: 60 * 60 * 1000,
});

let Pokemon = createResource({
  query(name) {
    let url = `https://pokeapi.co/api/v2/pokemon/${name}/`;
    return fetch(url).then(response => response.json());
  },
});

function PokemonListSection() {
  let [{ offset, limit }, setParams] = useState({ offset: 0, limit: 10 });
  return (
    <section className="pokemon-list">
      <Suspense fallback={<PokemonListSkeleton limit={limit} />}>
        <PokemonList offset={offset} limit={limit} />
      </Suspense>
      <div className="pokemon-pagination">
        <button
          onClick={() => setParams({ offset: offset - limit, limit })}
          disabled={offset === 0}
        >
          &larr;
        </button>
        <button onClick={() => setParams({ offset: offset + limit, limit })}>
          &rarr;
        </button>
      </div>
    </section>
  );
}

function PokemonProfileSection() {
  return (
    <section className="pokemon-profile">
      <Switch>
        <Route exact path="/:pokemonName">
          <PokemonPage />
        </Route>
        <p>Please select a pokemon from the list.</p>
      </Switch>
    </section>
  );
}

function PokemonList({ offset, limit }) {
  let pokemons = useResourceSync(Pokemons, [offset, limit]);
  return (
    <ul>
      {pokemons.map(pokemon => (
        <li key={pokemon.name}>
          <NavLink to={`/${pokemon.name}`}>{pokemon.name}</NavLink>
        </li>
      ))}
    </ul>
  );
}

function PokemonListSkeleton({ limit }) {
  let list = Array.from(Array(limit), (_, i) => i + 1);
  return (
    <ul>
      {list.map(index => (
        <li key={index}>
          <a href="#" className="skeleton">
            {'x'.repeat(Math.random() * 10 + 5)}
          </a>
        </li>
      ))}
    </ul>
  );
}

function PokemonPage() {
  let { pokemonName } = useParams();
  return (
    <Suspense fallback={<p>Loading {pokemonName} profile…</p>}>
      <PokemonInfo name={pokemonName} />
    </Suspense>
  );
}

function PokemonInfo({ name }) {
  let pokemon = useResourceSync(Pokemon, [name]);
  return (
    <Fragment>
      <Img src={pokemon.sprites.front_default} />
      <p>
        <strong>{pokemon.name}</strong>
      </p>
      <dl>
        {pokemon.stats.map(datum => (
          <Fragment key={datum.stat.name}>
            <dt>{datum.stat.name}</dt>
            <dd>{datum.base_stat}</dd>
          </Fragment>
        ))}
      </dl>
    </Fragment>
  );
}
