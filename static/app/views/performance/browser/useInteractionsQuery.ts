import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useBrowserModuleFilters} from 'sentry/views/performance/browser/useBrowserFilters';

export const useInteractionsQuery = () => {
  const pageFilters = usePageFilters();
  const browserFilters = useBrowserModuleFilters();
  const location = useLocation();
  const {slug: orgSlug} = useOrganization();
  const queryConditions = [
    'has:interactionElement',
    browserFilters.page ? `transaction:${browserFilters.page}` : '',
  ];

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'interactionElement',
        'transaction',
        'transaction.op',
        'p75(transaction.duration)',
        'count()',
      ],
      name: 'Interaction module - interactions table',
      query: queryConditions.join(' '),
      orderby: '-count',
      version: 2,
    },
    pageFilters.selection
  );

  const result = useDiscoverQuery({eventView, limit: 50, location, orgSlug});

  const data = result?.data?.data.map(row => ({
    transaction: row.transaction.toString(),
    interactionElement: row.interactionElement.toString(),
    'transaction.op': row['transaction.op'].toString(),
    'p75(transaction.duration)': row['p75(transaction.duration)'] as number,
    'count()': row['count()'] as number,
  }));

  return {...result, data: data || []};
};
