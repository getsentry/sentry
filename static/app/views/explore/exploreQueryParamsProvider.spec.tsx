import type {ReactNode} from 'react';
import {parseAsString} from 'nuqs';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {ExploreQueryParamsProvider} from 'sentry/views/explore/exploreQueryParamsProvider';
import {
  useQueryParamsQuery,
  useSetQueryParams,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

const parsers = {q: parseAsString};

function getReadableQueryParams(values: {q: string | null}): ReadableQueryParams {
  return new ReadableQueryParams({
    extrapolate: true,
    mode: Mode.SAMPLES,
    query: values.q ?? '',
    cursor: '',
    fields: ['timestamp'],
    sortBys: [],
    aggregateCursor: '',
    aggregateFields: [],
    aggregateSortBys: [],
  });
}

function getQueryParamsUpdates(writableQueryParams: WritableQueryParams) {
  return {q: writableQueryParams.query};
}

function isDefaultFields(): boolean {
  return true;
}

function TestComponent() {
  const query = useQueryParamsQuery();
  const setQueryParams = useSetQueryParams();
  const setQuery = useSetQueryParamsQuery();
  return (
    <div>
      <div>query: {query}</div>
      <Button onClick={() => setQuery('changed')}>set changed</Button>
      <Button onClick={() => setQueryParams({query: 'replaced'}, {replace: true})}>
        set replaced
      </Button>
      <Button onClick={() => setQuery(query)}>set same</Button>
    </div>
  );
}

function Wrapper({children}: {children: ReactNode}) {
  return (
    <ExploreQueryParamsProvider
      getQueryParamsUpdates={getQueryParamsUpdates}
      getReadableQueryParams={getReadableQueryParams}
      isDefaultFields={isDefaultFields}
      parsers={parsers}
    >
      {children}
    </ExploreQueryParamsProvider>
  );
}

describe('ExploreQueryParamsProvider', () => {
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

  it('replaces the current history entry when requested', async () => {
    const {router} = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>,
      {initialRouterConfig: {location: {pathname: '/traces/', query: {q: 'start'}}}}
    );

    await userEvent.click(screen.getByRole('button', {name: 'set changed'}));
    expect(await screen.findByText('query: changed')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'set replaced'}));
    expect(await screen.findByText('query: replaced')).toBeInTheDocument();

    router.navigate(-1);
    await waitFor(() => expect(router.location.query.q).toBe('start'));
  });
});
