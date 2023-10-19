import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useBrowserModuleFilters} from 'sentry/views/performance/browser/useBrowserFilters';

export const useInteractionQuery = () => {
  const pageFilters = usePageFilters();
  const browserFilters = useBrowserModuleFilters();
  const location = useLocation();
  const {slug: orgSlug} = useOrganization();
  const queryConditions = [
    `transaction:"${browserFilters.page}"`,
    `interactionElement:"${browserFilters.component?.replaceAll('"', '\\"')}"`,
  ];

  // TODO - we should be using metrics data here
  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: ['id', 'transaction.duration', 'project'],
      name: 'Interaction module - interactions table',
      query: queryConditions.join(' '),
      orderby: '-transaction.duration',
      version: 2,
    },
    pageFilters.selection
  );

  const result = useDiscoverQuery({eventView, limit: 15, location, orgSlug});

  const data = result?.data?.data.map(row => ({
    eventId: row.id.toString(),
    project: row.project.toString(),
    'transaction.duration': row['transaction.duration'] as number,
  }));

  return {...result, data: data || []};
};
