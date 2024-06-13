import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

/**
 * Query results for whether a given replayId exists in the database (not deleted, etc)
 */
export default function useProfileExists(ids: string[]) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: ['profile.id'],
      name: 'Web Vitals',
      query: `profile.id:[${ids.join(',')}]`,
      version: 2,
      dataset: DiscoverDatasets.DISCOVER,
    },
    pageFilters.selection
  );

  const {data} = useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
    limit: 100,
    options: {
      enabled: !!ids.length,
    },
  });

  const profileExists = (id: string) => {
    if (!ids.length) {
      return false;
    }
    return !!data?.data?.some(row => row['profile.id'] === id);
  };
  return {profileExists};
}
