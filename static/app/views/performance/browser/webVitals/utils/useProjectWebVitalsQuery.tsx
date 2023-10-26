import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView, {fromSorts} from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  DEFAULT_SORT,
  SORTABLE_FIELDS,
} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  defaultSort?: Sort;
  sortName?: string;
  transaction?: string;
};

export const useProjectWebVitalsQuery = ({
  transaction,
  defaultSort,
  sortName = 'sort',
}: Props = {}) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const sort = useWebVitalsSort({sortName, defaultSort});

  const projectEventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.ttfb)',
        'p75(measurements.fid)',
        'count()',
        'failure_count()',
        'p95(transaction.duration)',
        'eps()',
      ],
      name: 'Web Vitals',
      query:
        'transaction.op:pageload' + (transaction ? ` transaction:"${transaction}"` : ''),
      version: 2,
      dataset: DiscoverDatasets.METRICS,
    },
    pageFilters.selection
  );

  projectEventView.sorts = [sort];

  return useDiscoverQuery({
    eventView: projectEventView,
    limit: 50,
    location,
    orgSlug: organization.slug,
    options: {
      enabled: pageFilters.isReady,
      refetchOnWindowFocus: false,
    },
  });
};

export function useWebVitalsSort({
  sortName = 'sort',
  defaultSort = DEFAULT_SORT,
}: {
  defaultSort?: Sort;
  sortName?: string;
} = {}) {
  const location = useLocation();

  const sort =
    fromSorts(decodeScalar(location.query[sortName])).filter(s =>
      (SORTABLE_FIELDS as unknown as string[]).includes(s.field)
    )[0] ?? defaultSort;

  return sort;
}
