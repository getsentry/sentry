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
 * Gets a list of pages on the selected project(s)
 */
export const usePagesQuery = () => {
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {slug: orgSlug} = useOrganization();
  const browserFilters = useBrowserModuleFilters();

  const fields = ['transaction', 'p75(transaction.duration)', 'tpm()'];
  const queryConditions = [
    'event.type:transaction',
    browserFilters.component ? `interactionElement:"${browserFilters.component}"` : '',
    browserFilters['transaction.op']
      ? `transaction.op:"${browserFilters[BrowserStarfishFields.TRANSACTION_OP]}"`
      : '',
  ]; // TODO: We will need to consider other ops

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields, // for some reason we need a function, otherwise the query fails
      name: 'Interaction module - page selector',
      version: 2,
      query: queryConditions.join(' '),
      orderby: 'transaction',
    },
    pageFilters.selection
  );

  const result = useDiscoverQuery({
    eventView,
    location,
    orgSlug,
    limit: 100,
  });

  const pages = result?.data?.data.map(row => row.transaction.toString()) || [];
  return {...result, data: pages};
};
