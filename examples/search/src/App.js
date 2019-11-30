import React, { Suspense, useState } from 'react';
import { createResource, useQuery } from 'react-warehouse';
import useDebouncedValue from './useDebouncedValue';

let Search = createResource({
  query(query) {
    let url = `https://api.npms.io/v2/search?from=0&size=25&q=${query}`;
    let controller = new AbortController();
    let onCancel = () => controller.abort();
    let request = fetch(url, {
      signal: controller.signal,
    }).then(response => response.json());
    return [request, onCancel];
  },
  capacity: 1,
});

export default function App() {
  let [text, setText] = useState('');
  let query = useDebouncedValue(text, 100);
  return (
    <article>
      <input
        type="text"
        value={text}
        onChange={event => setText(event.target.value)}
      />
      {query.length > 0 ? (
        <Suspense fallback={<p>Searching {query}…</p>}>
          <SearchResults query={query} />
        </Suspense>
      ) : null}
    </article>
  );
}

function SearchResults({ query }) {
  let { results } = useQuery(Search, query);
  return results.length > 0 ? (
    <ul>
      {results.map(result => (
        <li key={result.package.name}>
          <h3 className="package-name">
            <a
              href={result.package.links.npm}
              target="_blank"
              rel="noopener noreferrer"
            >
              {result.package.name}
            </a>{' '}
            <small className="package-version">
              ({result.package.version})
            </small>
          </h3>
          <p className="package-description">{result.package.description}</p>
        </li>
      ))}
    </ul>
  ) : (
    <p>No results</p>
  );
}
