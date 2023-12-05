import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {RowWithScore} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';

type Props = {
  defaultSort?: Sort;
  enabled?: boolean;
  limit?: number;
  sortName?: string;
  transaction?: string | null;
};

export const useTransactionRawWebVitalsQuery = ({
  limit,
  transaction,
  defaultSort,
  sortName = 'sort',
  enabled = true,
}: Props) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const sort = useWebVitalsSort({sortName, defaultSort});

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'transaction',
        'transaction.op',
        'avg(measurements.lcp)',
        'avg(measurements.fcp)',
        'avg(measurements.cls)',
        'avg(measurements.ttfb)',
        'avg(measurements.fid)',
        'count()',
      ],
      name: 'Web Vitals',
      query:
        'transaction.op:pageload' + (transaction ? ` transaction:"${transaction}"` : ''),
      version: 2,
      dataset: DiscoverDatasets.METRICS,
    },
    pageFilters.selection
  );

  eventView.sorts = [sort];

  const {data, isLoading, ...rest} = useDiscoverQuery({
    eventView,
    limit: limit ?? 50,
    location,
    orgSlug: organization.slug,
    options: {
      enabled: pageFilters.isReady && enabled,
      refetchOnWindowFocus: false,
    },
    referrer: 'api.performance.browser.web-vitals.transactions',
  });

  const tableData: RowWithScore[] =
    !isLoading && data?.data.length
      ? data.data
          .map(row => ({
            transaction: row.transaction?.toString(),
            'transaction.op': row['transaction.op']?.toString(),
            'avg(measurements.lcp)': row['avg(measurements.lcp)'] as number,
            'avg(measurements.fcp)': row['avg(measurements.fcp)'] as number,
            'avg(measurements.cls)': row['avg(measurements.cls)'] as number,
            'avg(measurements.ttfb)': row['avg(measurements.ttfb)'] as number,
            'avg(measurements.fid)': row['avg(measurements.fid)'] as number,
            'count()': row['count()'] as number,
          }))
          .map(row => {
            const {totalScore, clsScore, fcpScore, lcpScore, ttfbScore, fidScore} =
              calculatePerformanceScore({
                lcp: row['avg(measurements.lcp)'],
                fcp: row['avg(measurements.fcp)'],
                cls: row['avg(measurements.cls)'],
                ttfb: row['avg(measurements.ttfb)'],
                fid: row['avg(measurements.fid)'],
              });
            return {
              ...row,
              score: totalScore ?? 0,
              clsScore: clsScore ?? 0,
              fcpScore: fcpScore ?? 0,
              lcpScore: lcpScore ?? 0,
              ttfbScore: ttfbScore ?? 0,
              fidScore: fidScore ?? 0,
            };
          })
      : [];

  return {
    data: tableData,
    isLoading,
    ...rest,
  };
};
