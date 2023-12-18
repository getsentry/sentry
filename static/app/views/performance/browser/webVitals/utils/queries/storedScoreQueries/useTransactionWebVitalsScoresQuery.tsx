import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {
  RowWithScoreAndOpportunity,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';

type Props = {
  defaultSort?: Sort;
  enabled?: boolean;
  limit?: number;
  opportunityWebVital?: WebVitals | 'total';
  query?: string;
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
  query,
}: Props) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const sort = useWebVitalsSort({sortName, defaultSort});

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'transaction',
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.ttfb)',
        'p75(measurements.fid)',
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.cls)',
        'performance_score(measurements.score.fid)',
        'performance_score(measurements.score.ttfb)',
        'avg(measurements.score.total)',
        'count()',
        `opportunity_score(measurements.score.${opportunityWebVital})`,
        'count_scores(measurements.score.lcp)',
        'count_scores(measurements.score.fcp)',
        'count_scores(measurements.score.cls)',
        'count_scores(measurements.score.ttfb)',
        'count_scores(measurements.score.fid)',
      ],
      name: 'Web Vitals',
      query: [
        'transaction.op:pageload',
        'avg(measurements.score.total):>=0',
        ...(transaction ? [`transaction:"${transaction}"`] : []),
        ...(query ? [query] : []),
      ].join(' '),
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

  const tableData: RowWithScoreAndOpportunity[] =
    !isLoading && data?.data.length
      ? data.data.map(row => {
          const {totalScore, clsScore, fcpScore, lcpScore, ttfbScore, fidScore} =
            calculatePerformanceScoreFromStoredTableDataRow(row);
          return {
            transaction: row.transaction?.toString(),
            'p75(measurements.lcp)': row['p75(measurements.lcp)'] as number,
            'p75(measurements.fcp)': row['p75(measurements.fcp)'] as number,
            'p75(measurements.cls)': row['p75(measurements.cls)'] as number,
            'p75(measurements.ttfb)': row['p75(measurements.ttfb)'] as number,
            'p75(measurements.fid)': row['p75(measurements.fid)'] as number,
            'count()': row['count()'] as number,
            'count_scores(measurements.score.lcp)': row[
              'count_scores(measurements.score.lcp)'
            ] as number,
            'count_scores(measurements.score.fcp)': row[
              'count_scores(measurements.score.fcp)'
            ] as number,
            'count_scores(measurements.score.cls)': row[
              'count_scores(measurements.score.cls)'
            ] as number,
            'count_scores(measurements.score.ttfb)': row[
              'count_scores(measurements.score.ttfb)'
            ] as number,
            'count_scores(measurements.score.fid)': row[
              'count_scores(measurements.score.fid)'
            ] as number,
            totalScore: totalScore ?? 0,
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
