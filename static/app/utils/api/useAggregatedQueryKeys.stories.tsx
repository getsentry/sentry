import {Fragment, useCallback, useEffect} from 'react';

import {StructuredEventData} from 'sentry/components/structuredEventData';
import * as Storybook from 'sentry/stories';
import type {Team} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {useAggregatedQueryKeys} from 'sentry/utils/api/useAggregatedQueryKeys';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUserTeams} from 'sentry/utils/useUserTeams';

type TeamSlugsById = Record<string, undefined | string>;

export default Storybook.story('useAggregatedQueryKeys', story => {
  story('useAggregatedQueryKeys', () => {
    const organization = useOrganization();

    // Get a list of valid teamIds to use as demo aggregation keys.
    const {teams: userTeams} = useUserTeams();

    const cache = useAggregatedQueryKeys<string, TeamSlugsById, Team[]>({
      getQueryOptions: useCallback(
        ids =>
          apiOptions.as<Team[]>()('/organizations/$organizationIdOrSlug/teams/', {
            path: {organizationIdOrSlug: organization.slug},
            query: {
              // The teams endpoint reads one id per `id:` token, not a list.
              query: ids.map(id => `id:${id}`).join(' '),
              detailed: 0,
            },
            staleTime: 0,
          }),
        [organization.slug]
      ),
      onError: useCallback(() => {}, []),
      // Other components cache their own /teams/ lists; only fold in the
      // responses to our id lookups.
      queryFilter: useCallback((queryKey: readonly unknown[]) => {
        const search = safeParseQueryKey(queryKey)?.options.query?.query;
        return typeof search === 'string' && search.startsWith('id:');
      }, []),
      responseReducer: useCallback((prevState, response) => {
        const slugs = Object.fromEntries(response.json.map(team => [team.id, team.slug]));
        return {...prevState, ...slugs};
      }, []),
    });

    useEffect(() => {
      // Request only the first team's id as a demo aggregate key
      const firstTeam = userTeams[0];
      if (firstTeam) {
        cache.buffer([firstTeam.id]);
      }
    }, [cache, userTeams]);
    useEffect(() => {
      // Request some more ids separately
      const moreTeams = userTeams.slice(1, 3);
      if (moreTeams.length) {
        cache.buffer(moreTeams.map(team => team.id));
      }
    }, [cache, userTeams]);

    return (
      <Fragment>
        <p>
          Checkout the network traffic to really understand how this works. We've called{' '}
          <code>cache.buffer()</code> in two independent places, but those 3 team ids were
          grouped together into one <code>/teams/?query=id:… id:… id:…</code> request on
          the network.
        </p>
        <StructuredEventData data={cache.data} />
      </Fragment>
    );
  });
});
