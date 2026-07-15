import type {ReactNode} from 'react';
import type {Location} from 'history';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {ExploreLocationQueryParamsProvider} from 'sentry/views/explore/exploreLocationQueryParamsProvider';
import {
  useQueryParamsQuery,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

function getReadableQueryParamsFromLocation(location: Location): ReadableQueryParams {
  return new ReadableQueryParams({
    extrapolate: true,
    mode: Mode.SAMPLES,
    query: decodeScalar(location.query.q) ?? '',
    cursor: '',
    fields: ['timestamp'],
    sortBys: [],
    aggregateCursor: '',
    aggregateFields: [],
    aggregateSortBys: [],
  });
}

function getTargetWithReadableQueryParams(
  location: Location,
  writableQueryParams: WritableQueryParams
): Location {
  const target: Location = {...location, query: {...location.query}};
  if (defined(writableQueryParams.query)) {
    target.query.q = writableQueryParams.query;
  }
  return target;
}

function isDefaultFields(): boolean {
  return true;
}

function TestComponent() {
  const query = useQueryParamsQuery();
  const setQuery = useSetQueryParamsQuery();
  return (
    <div>
      <div>query: {query}</div>
      <button onClick={() => setQuery('changed')}>set changed</button>
      <button onClick={() => setQuery(query)}>set same</button>
    </div>
  );
}

function Wrapper({children}: {children: ReactNode}) {
  return (
    <ExploreLocationQueryParamsProvider
      getReadableQueryParamsFromLocation={getReadableQueryParamsFromLocation}
      getTargetWithReadableQueryParams={getTargetWithReadableQueryParams}
      isDefaultFields={isDefaultFields}
    >
      {children}
    </ExploreLocationQueryParamsProvider>
  );
}

describe('ExploreLocationQueryParamsProvider', () => {
  it('navigates when the query changes', async () => {
    const {router} = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>,
      {initialRouterConfig: {location: {pathname: '/traces/', query: {q: 'start'}}}}
    );

    await userEvent.click(screen.getByRole('button', {name: 'set changed'}));

    expect(await screen.findByText('query: changed')).toBeInTheDocument();
    expect(router.location.query.q).toBe('changed');
  });

  it('does not add a history entry when the target matches the current location', async () => {
    const {router} = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>,
      {initialRouterConfig: {location: {pathname: '/traces/', query: {q: 'start'}}}}
    );

    await userEvent.click(screen.getByRole('button', {name: 'set changed'}));
    expect(await screen.findByText('query: changed')).toBeInTheDocument();

    // Re-applying the same query must be a no-op, otherwise it pushes a
    // duplicate history entry and breaks the browser back button.
    await userEvent.click(screen.getByRole('button', {name: 'set same'}));

    // A single back returns to the original query, proving the same-value set
    // did not push a duplicate 'changed' entry.
    router.navigate(-1);
    await waitFor(() => expect(router.location.query.q).toBe('start'));
  });
});
