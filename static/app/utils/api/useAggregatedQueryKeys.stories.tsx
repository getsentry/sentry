import {Fragment, useCallback, useEffect} from 'react';

import {StructuredEventData} from 'sentry/components/structuredEventData';
import * as Storybook from 'sentry/stories';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useAggregatedQueryKeys} from 'sentry/utils/api/useAggregatedQueryKeys';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUserTeams} from 'sentry/utils/useUserTeams';

type CountState = Record<string, undefined | number>;

export default Storybook.story('useAggregatedQueryKeys', story => {
  story('useAggregatedQueryKeys', () => {
    const organization = useOrganization();

    // Get a list of valid teamIds to use as demo aggregation keys.
    const {teams: userTeams} = useUserTeams();

    const cache = useAggregatedQueryKeys<string, CountState>({
      getQueryOptions: useCallback(
        ids =>
          apiOptions.as<CountState>()(
            '/organizations/$organizationIdOrSlug/replay-count/',
            {
              path: {organizationIdOrSlug: organization.slug},
              query: {
                data_source: 'discover',
                project: -1,
                statsPeriod: '14d',
                query: `issue.id:[${ids.join(',')}]`,
              },
              staleTime: 0,
            }
          ),
        [organization.slug]
      ),
      onError: useCallback(() => {}, []),
      responseReducer: useCallback((prevState, response, aggregates) => {
        const defaults = Object.fromEntries(aggregates.map(id => [id, 0]));
        return {...defaults, ...prevState, ...response.json};
      }, []),
      bufferLimit: 50,
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
          <code>cache.buffer()</code> in two independent places, but those 3 ids were
          grouped together into one request on the network.
        </p>
        <StructuredEventData data={cache.data} />
      </Fragment>
    );
  });
});
