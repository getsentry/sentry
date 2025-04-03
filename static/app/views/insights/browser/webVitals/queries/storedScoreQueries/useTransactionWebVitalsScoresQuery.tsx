import type {Sort} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getWebVitalScoresFromTableDataRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import type {
  RowWithScoreAndOpportunity,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useWebVitalsSort} from 'sentry/views/insights/browser/webVitals/utils/useWebVitalsSort';
import {useMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {
  type MetricsProperty,
  SpanIndexedField,
  type SubregionCode,
} from 'sentry/views/insights/types';

type Props = {
  browserTypes?: BrowserType[];
  defaultSort?: Sort;
  enabled?: boolean;
  limit?: number;
  query?: string;
  shouldEscapeFilters?: boolean;
  sortName?: string;
  subregions?: SubregionCode[];
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
  browserTypes,
  subregions,
}: Props) => {
  const sort = useWebVitalsSort({sortName, defaultSort});
  if (sort !== undefined) {
    if (sort.field === 'avg(measurements.score.total)') {
      sort.field = 'performance_score(measurements.score.total)';
    }
    if (sort.field === 'opportunity_score(measurements.score.total)') {
      sort.field = 'total_opportunity_score()';
    }
  }

  const search = new MutableSearch([
    'avg(measurements.score.total):>=0',
    ...(query ? [query] : []),
  ]);
  if (transaction) {
    search.addFilterValue('transaction', transaction, shouldEscapeFilters);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanIndexedField.BROWSER_NAME, browserTypes);
  }
  if (subregions) {
    search.addDisjunctionFilterValues(SpanIndexedField.USER_GEO_SUBREGION, subregions);
  }

  const {data, isPending, ...rest} = useMetrics(
    {
      limit: limit ?? 50,
      search: [DEFAULT_QUERY_FILTER, search.formatString()].join(' ').trim(),
      enabled,
      sorts: [sort],
      fields: [
        'project.id',
        'project',
        'transaction',
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.ttfb)',
        'p75(measurements.inp)',
        `opportunity_score(measurements.score.${webVital})`,
        'performance_score(measurements.score.total)',
        'count()',
        `count_scores(measurements.score.lcp)`,
        `count_scores(measurements.score.fcp)`,
        `count_scores(measurements.score.cls)`,
        `count_scores(measurements.score.inp)`,
        `count_scores(measurements.score.ttfb)`,
        'total_opportunity_score()',
        ...(webVital === 'total'
          ? []
          : [`performance_score(measurements.score.${webVital})` as MetricsProperty]),
      ],
    },
    'api.performance.browser.web-vitals.transactions-scores'
  );

  const tableData: RowWithScoreAndOpportunity[] =
    !isPending && data?.length
      ? data.map<RowWithScoreAndOpportunity>(row => {
          // Map back performance score key so we don't have to handle both keys in the UI
          if (row['performance_score(measurements.score.total)'] !== undefined) {
            row['avg(measurements.score.total)'] =
              row['performance_score(measurements.score.total)'];
          }
          const {totalScore, clsScore, fcpScore, lcpScore, ttfbScore, inpScore} =
            getWebVitalScoresFromTableDataRow(row);
          return {
            transaction: row.transaction?.toString()!,
            project: row.project?.toString()!,
            'project.id': parseInt(row['project.id']!.toString(), 10),
            'p75(measurements.lcp)': row['p75(measurements.lcp)'] as number,
            'p75(measurements.fcp)': row['p75(measurements.fcp)'] as number,
            'p75(measurements.cls)': row['p75(measurements.cls)'] as number,
            'p75(measurements.ttfb)': row['p75(measurements.ttfb)'] as number,
            'p75(measurements.inp)': row['p75(measurements.inp)'] as number,
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
            inpScore: inpScore ?? 0,
            // Map back opportunity score key so we don't have to handle both keys in the UI
            opportunity: row[
              webVital === 'total'
                ? 'total_opportunity_score()'
                : (`opportunity_score(measurements.score.${webVital})` as MetricsProperty)
            ] as number,
          };
        })
      : [];

  return {
    data: tableData,
    isPending,
    ...rest,
  };
};
