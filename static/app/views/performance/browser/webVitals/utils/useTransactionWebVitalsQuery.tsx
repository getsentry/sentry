import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {
  RowWithScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  limit?: number;
  orderBy?: WebVitals | null;
  transaction?: string | null;
};

export const useTransactionWebVitalsQuery = ({orderBy, limit, transaction}: Props) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'transaction',
        'transaction.op',
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.ttfb)',
        'p75(measurements.fid)',
        'count()',
      ],
      name: 'Web Vitals',
      query:
        'transaction.op:pageload' + (transaction ? ` transaction:*${transaction}*` : ''),
      orderby: mapWebVitalToOrderBy(orderBy),
      version: 2,
    },
    pageFilters.selection
  );

  const {data, isLoading, ...rest} = useDiscoverQuery({
    eventView,
    limit: limit ?? 50,
    location,
    orgSlug: organization.slug,
    options: {
      enabled: pageFilters.isReady,
      refetchOnWindowFocus: false,
    },
  });

  const tableData: RowWithScore[] =
    !isLoading && data?.data.length
      ? data.data
          .map(row => ({
            transaction: row.transaction?.toString(),
            'transaction.op': row['transaction.op']?.toString(),
            'p75(measurements.lcp)': row['p75(measurements.lcp)'] as number,
            'p75(measurements.fcp)': row['p75(measurements.fcp)'] as number,
            'p75(measurements.cls)': row['p75(measurements.cls)'] as number,
            'p75(measurements.ttfb)': row['p75(measurements.ttfb)'] as number,
            'p75(measurements.fid)': row['p75(measurements.fid)'] as number,
            'count()': row['count()'] as number,
          }))
          .map(row => {
            const {totalScore, clsScore, fcpScore, lcpScore, ttfbScore, fidScore} =
              calculatePerformanceScore({
                lcp: row['p75(measurements.lcp)'],
                fcp: row['p75(measurements.fcp)'],
                cls: row['p75(measurements.cls)'],
                ttfb: row['p75(measurements.ttfb)'],
                fid: row['p75(measurements.fid)'],
              });
            return {
              ...row,
              score: totalScore,
              clsScore,
              fcpScore,
              lcpScore,
              ttfbScore,
              fidScore,
            };
          })
      : [];

  return {
    data: tableData,
    isLoading,
    ...rest,
  };
};

const mapWebVitalToOrderBy = (webVital?: WebVitals | null) => {
  switch (webVital) {
    case 'lcp':
      return '-p75_measurements_lcp';
    case 'fcp':
      return '-p75_measurements_fcp';
    case 'cls':
      return '-p75_measurements_cls';
    case 'ttfb':
      return '-p75_measurements_ttfb';
    case 'fid':
      return '-p75_measurements_fid';
    default:
      return '-count';
  }
};
