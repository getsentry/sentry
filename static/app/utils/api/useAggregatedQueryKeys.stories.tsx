import {Fragment, useCallback, useEffect} from 'react';

import type {ApiResult} from 'sentry/api';
import StructuredEventData from 'sentry/components/structuredEventData';
import storyBook from 'sentry/stories/storyBook';
import type {Team} from 'sentry/types/organization';
import useAggregatedQueryKeys from 'sentry/utils/api/useAggregatedQueryKeys';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useUserTeams} from 'sentry/utils/useUserTeams';

export default storyBook('useAggregatedQueryKeys', story => {
  story('useAggregatedQueryKeys', () => {
    const organization = useOrganization();

    // Get a list of valid teamIds for the demo.
    const {teams: userTeams} = useUserTeams();

    const cache = useAggregatedQueryKeys<string, Team[]>({
      getQueryKey: useCallback(
        (ids: readonly string[]): ApiQueryKey => {
          return [
            `/organizations/${organization.slug}/teams/`,
            {
              query: {
                query: ids.map(id => `id:${id}`).join(' '),
              },
            },
          ];
        },
        [organization.slug]
      ),
      onError: useCallback(() => {}, []),
      responseReducer: useCallback(
        (
          prevState: undefined | Team[],
          response: ApiResult,
          _aggregates: readonly string[]
        ) => {
          return {...prevState, ...response[0]};
        },
        []
      ),
      bufferLimit: 50,
    });

    useEffect(() => {
      // Request only the first team
      const firstTeam = userTeams[0];
      if (firstTeam) {
        cache.buffer([firstTeam.id]);
      }
    }, [cache, userTeams]);
    useEffect(() => {
      // Request some more teams separatly
      const moreTeams = userTeams.slice(1, 3);
      if (moreTeams.length) {
        cache.buffer(moreTeams.map(team => team.id));
      }
    }, [cache, userTeams]);

    return (
      <Fragment>
        <p>
          Checkout the network traffic to really understand how this works. We've called{' '}
          <code>cache.buffer()</code> in two independent places, but those 3 ids were
          grouped together into one request on the network.
        </p>
        <StructuredEventData data={cache.data} />
      </Fragment>
    );
  });
});
