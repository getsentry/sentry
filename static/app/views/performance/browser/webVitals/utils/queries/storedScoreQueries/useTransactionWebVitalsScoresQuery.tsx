import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {
  RowWithScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';

type Props = {
  defaultSort?: Sort;
  enabled?: boolean;
  limit?: number;
  opportunityWebVital?: WebVitals | 'total';
  sortName?: string;
  transaction?: string | null;
};

export const useTransactionWebVitalsScoresQuery = ({
  limit,
  transaction,
  defaultSort,
  sortName = 'sort',
  enabled = true,
  opportunityWebVital = 'total',
}: Props) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const sort = useWebVitalsSort({sortName, defaultSort});

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'transaction',
        'avg(measurements.lcp)',
        'avg(measurements.fcp)',
        'avg(measurements.cls)',
        'avg(measurements.ttfb)',
        'avg(measurements.fid)',
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.cls)',
        'performance_score(measurements.score.fid)',
        'performance_score(measurements.score.ttfb)',
        'avg(measurements.score.total)',
        'count()',
        `opportunity_score(measurements.score.${opportunityWebVital})`,
      ],
      name: 'Web Vitals',
      query:
        'transaction.op:pageload avg(measurements.score.total):>=0' +
        (transaction ? ` transaction:"${transaction}"` : ''),
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
      enabled,
      refetchOnWindowFocus: false,
    },
    referrer: 'api.performance.browser.web-vitals.transactions-scores',
  });

  const tableData: RowWithScore[] =
    !isLoading && data?.data.length
      ? data.data.map(row => {
          const {totalScore, clsScore, fcpScore, lcpScore, ttfbScore, fidScore} =
            calculatePerformanceScoreFromStoredTableDataRow(row);
          return {
            transaction: row.transaction?.toString(),
            'avg(measurements.lcp)': row['avg(measurements.lcp)'] as number,
            'avg(measurements.fcp)': row['avg(measurements.fcp)'] as number,
            'avg(measurements.cls)': row['avg(measurements.cls)'] as number,
            'avg(measurements.ttfb)': row['avg(measurements.ttfb)'] as number,
            'avg(measurements.fid)': row['avg(measurements.fid)'] as number,
            'count()': row['count()'] as number,
            score: totalScore ?? 0,
            clsScore: clsScore ?? 0,
            fcpScore: fcpScore ?? 0,
            lcpScore: lcpScore ?? 0,
            ttfbScore: ttfbScore ?? 0,
            fidScore: fidScore ?? 0,
            opportunity: row[
              `opportunity_score(measurements.score.${opportunityWebVital})`
            ] as number,
          };
        })
      : [];

  return {
    data: tableData,
    isLoading,
    ...rest,
  };
};
