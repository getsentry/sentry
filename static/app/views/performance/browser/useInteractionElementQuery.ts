import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  BrowserStarfishFields,
  useBrowserModuleFilters,
} from 'sentry/views/performance/browser/useBrowserFilters';

/**
 * Gets a list of all interactionElements on the selected project(s)
 */
export const useInteractionElementQuery = () => {
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {slug: orgSlug} = useOrganization();
  const browserFilters = useBrowserModuleFilters();

  const fields = ['interactionElement', 'count()'];
  const queryConditions = [
    'has:interactionElement',
    browserFilters.page ? `transaction:"${browserFilters.page}"` : '',
    browserFilters['transaction.op']
      ? `transaction.op:"${browserFilters[BrowserStarfishFields.TRANSACTION_OP]}"`
      : '',
  ];

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields,
      name: 'Interaction module - page selector',
      version: 2,
      query: queryConditions.join(' '),
      orderby: 'interactionElement',
    },
    pageFilters.selection
  );

  const result = useDiscoverQuery({
    eventView,
    location,
    orgSlug,
    limit: 100,
  });

  const interactionElements =
    result?.data?.data.map(row => row.interactionElement.toString()) || [];
  return {...result, data: interactionElements};
};
