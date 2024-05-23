import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import type {
  RowWithScoreAndOpportunity,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useAggregateFunction} from 'sentry/views/performance/browser/webVitals/utils/useAggregateFunction';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';

type Props = {
  defaultSort?: Sort;
  enabled?: boolean;
  limit?: number;
  query?: string;
  shouldEscapeFilters?: boolean;
  sortName?: string;
  transaction?: string | null;
  webVital?: WebVitals | 'total';
};

export const useTransactionWebVitalsScoresQuery = ({
  limit,
  transaction,
  defaultSort,
  sortName = 'sort',
  enabled = true,
  webVital = 'total',
  query,
  shouldEscapeFilters = true,
}: Props) => {
  const aggregateFunction = useAggregateFunction();
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const sort = useWebVitalsSort({sortName, defaultSort});

  const search = new MutableSearch([
    'avg(measurements.score.total):>=0',
    ...(query ? [query] : []),
  ]);
  if (transaction) {
    search.addFilterValue('transaction', transaction, shouldEscapeFilters);
  }
  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'transaction',
        `${aggregateFunction}(measurements.lcp)`,
        `${aggregateFunction}(measurements.fcp)`,
        `${aggregateFunction}(measurements.cls)`,
        `${aggregateFunction}(measurements.ttfb)`,
        `${aggregateFunction}(measurements.fid)`,
        `${aggregateFunction}(measurements.inp)`,
        ...(webVital !== 'total'
          ? [`performance_score(measurements.score.${webVital})`]
          : []),
        `opportunity_score(measurements.score.${webVital})`,
        'avg(measurements.score.total)',
        'count()',
        `count_scores(measurements.score.lcp)`,
        `count_scores(measurements.score.fcp)`,
        `count_scores(measurements.score.cls)`,
        `count_scores(measurements.score.fid)`,
        `count_scores(measurements.score.inp)`,
        `count_scores(measurements.score.ttfb)`,
      ],
      name: 'Web Vitals',
      query: [
        'transaction.op:[pageload,""]',
        'span.op:[ui.interaction.click,""]',
        search.formatString(),
      ]
        .join(' ')
        .trim(),
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
          const {
            totalScore,
            clsScore,
            fcpScore,
            lcpScore,
            ttfbScore,
            fidScore,
            inpScore,
          } = calculatePerformanceScoreFromStoredTableDataRow(row);
          return {
            transaction: row.transaction?.toString(),
            [`${aggregateFunction}(measurements.lcp)`]: row[
              `${aggregateFunction}(measurements.lcp)`
            ] as number,
            [`${aggregateFunction}(measurements.fcp)`]: row[
              `${aggregateFunction}(measurements.fcp)`
            ] as number,
            [`${aggregateFunction}(measurements.cls)`]: row[
              `${aggregateFunction}(measurements.cls)`
            ] as number,
            [`${aggregateFunction}(measurements.ttfb)`]: row[
              `${aggregateFunction}(measurements.ttfb)`
            ] as number,
            [`${aggregateFunction}(measurements.fid)`]: row[
              `${aggregateFunction}(measurements.fid)`
            ] as number,
            [`${aggregateFunction}(measurements.inp)`]: row[
              `${aggregateFunction}(measurements.inp)`
            ] as number,
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
            'count_scores(measurements.score.fid)': row[
              'count_scores(measurements.score.fid)'
            ] as number,
            'count_scores(measurements.score.inp)': row[
              'count_scores(measurements.score.inp)'
            ] as number,
            'count_scores(measurements.score.ttfb)': row[
              'count_scores(measurements.score.ttfb)'
            ] as number,
            totalScore: totalScore ?? 0,
            clsScore: clsScore ?? 0,
            fcpScore: fcpScore ?? 0,
            lcpScore: lcpScore ?? 0,
            ttfbScore: ttfbScore ?? 0,
            fidScore: fidScore ?? 0,
            inpScore: inpScore ?? 0,
            opportunity: row[
              `opportunity_score(measurements.score.${webVital})`
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
