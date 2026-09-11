import {Fragment, useCallback, useEffect} from 'react';
import {queryOptions} from '@tanstack/react-query';
import {TeamFixture} from 'sentry-fixture/team';

import {StructuredEventData} from 'sentry/components/structuredEventData';
import * as Storybook from 'sentry/stories';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useAggregatedQueryKeys} from 'sentry/utils/api/useAggregatedQueryKeys';

type CountState = Record<string, undefined | number>;

const TEAMS = [
  TeamFixture({id: '1', slug: 'backend'}),
  TeamFixture({id: '2', slug: 'frontend'}),
  TeamFixture({id: '3', slug: 'mobile'}),
];

/**
 * Stands in for the replay-count endpoint: resolves after a short delay with a
 * deterministic count per requested id, so the batching is observable without
 * a network request. Watch the console to see one call for all three ids.
 */
async function fetchCounts(ids: readonly string[]): Promise<{
  headers: {Link?: string};
  json: CountState;
}> {
  // eslint-disable-next-line no-console
  console.log('useAggregatedQueryKeys story: one request for ids', ids);
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    headers: {},
    json: Object.fromEntries(ids.map(id => [id, Number(id) * 7])),
  };
}

export default Storybook.story('useAggregatedQueryKeys', story => {
  story('useAggregatedQueryKeys', () => {
    const cache = useAggregatedQueryKeys<string, CountState>({
      getQueryOptions: useCallback(
        ids =>
          queryOptions({
            queryKey: [
              getApiUrl('/organizations/$organizationIdOrSlug/replay-count/', {
                path: {organizationIdOrSlug: 'org-slug'},
              }),
              {query: {data_source: 'discover', query: `issue.id:[${ids.join(',')}]`}},
              {infinite: false},
            ] as ApiQueryKey,
            queryFn: () => fetchCounts(ids),
            staleTime: 0,
            select: data => data.json,
          }),
        []
      ),
      onError: useCallback(() => {}, []),
      responseReducer: useCallback((prevState, response, aggregates) => {
        const defaults = Object.fromEntries(aggregates.map(id => [id, 0]));
        return {...defaults, ...prevState, ...response.json};
      }, []),
    });

    useEffect(() => {
      // Request only the first team's id as a demo aggregate key
      cache.buffer([TEAMS[0]!.id]);
    }, [cache]);
    useEffect(() => {
      // Request some more ids separately
      cache.buffer(TEAMS.slice(1).map(team => team.id));
    }, [cache]);

    return (
      <Fragment>
        <p>
          Check the console to really understand how this works. We've called{' '}
          <code>cache.buffer()</code> in two independent places, but those 3 ids were
          grouped together into one request.
        </p>
        <StructuredEventData data={cache.data} />
      </Fragment>
    );
  });
});
