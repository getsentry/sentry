import type {Sort} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  webVitalCountField,
  webVitalP75Field,
  webVitalScoreCountField,
  webVitalScoreField,
} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import {Referrer} from 'sentry/views/insights/browser/webVitals/referrers';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import {
  WEB_VITAL_TO_FIELD,
  type Opportunity,
  type Score,
  type WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import {
  addBrowserFilter,
  getMetricsSearch,
  type DeviceType,
} from 'sentry/views/insights/browser/webVitals/utils/deviceType';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useWebVitalsSort} from 'sentry/views/insights/browser/webVitals/utils/useWebVitalsSort';
import {
  useSpans,
  useTraceMetrics,
} from 'sentry/views/insights/common/queries/useDiscover';
import {
  SpanFields,
  type SpanProperty,
  type SubregionCode,
} from 'sentry/views/insights/types';

import {getWebVitalScoresFromTableDataRow} from './getWebVitalScoresFromTableDataRow';

type Props = {
  browserTypes?: BrowserType[];
  defaultSort?: Sort;
  deviceType?: DeviceType;
  enabled?: boolean;
  limit?: number;
  metricsQuery?: string;
  query?: string;
  sortName?: string;
  subregions?: SubregionCode[];
  webVital?: WebVitals | 'total';
};

export const useTransactionWebVitalsScoresQuery = ({
  limit,
  defaultSort,
  sortName = 'sort',
  webVital = 'total',
  enabled,
  query,
  browserTypes,
  deviceType,
  subregions,
  metricsQuery,
}: Props) => {
  const metricsVital =
    metricsQuery !== undefined && webVital !== 'total' ? webVital : undefined;
  const sort = useWebVitalsSort({sortName, defaultSort});

  const totalOpportunityScoreField =
    'opportunity_score(measurements.score.total)' satisfies SpanProperty;

  if (sort !== undefined) {
    if (sort.field === 'avg(measurements.score.total)') {
      // oxlint-disable-next-line react/immutability
      sort.field = 'performance_score(measurements.score.total)';
    }
  }

  const search = new MutableSearch([
    'avg(measurements.score.total):>=0',
    ...(query ? [query] : []),
  ]);
  addBrowserFilter(search, browserTypes, deviceType);
  if (subregions?.length) {
    search.addFilterValueList(SpanFields.USER_GEO_SUBREGION, subregions);
  }

  const {data, isPending, ...rest} = useSpans(
    {
      limit: limit ?? 50,
      search: [DEFAULT_QUERY_FILTER, search.formatString()].join(' ').trim(),
      sorts: [sort],
      enabled: enabled !== false && metricsQuery === undefined,
      fields: [
        'project.id',
        'project',
        'transaction',
        `p75(${SpanFields.BROWSER_WEB_VITAL_LCP_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_FCP_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_CLS_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_TTFB_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_INP_VALUE})`,
        ...(webVital === 'total'
          ? []
          : [`performance_score(measurements.score.${webVital})` as const]),
        `opportunity_score(measurements.score.${webVital})`,
        'performance_score(measurements.score.total)',
        'count()',
        'count_scores(measurements.score.lcp)',
        'count_scores(measurements.score.fcp)',
        'count_scores(measurements.score.cls)',
        'count_scores(measurements.score.inp)',
        'count_scores(measurements.score.ttfb)',
        'count_scores(measurements.score.total)',
        totalOpportunityScoreField,
      ],
    },
    Referrer.WEB_VITAL_TRANSACTIONS_SCORES
  );

  const tableData: Array<
    (typeof data)[0] & {'avg(measurements.score.total)': number} & Opportunity & Score
  > = data.map(row => {
    // Map back performance score key so we don't have to handle both keys in the UI
    const finalRow = {
      ...row,
      'avg(measurements.score.total)': row['performance_score(measurements.score.total)'],
    };
    const {totalScore, clsScore, fcpScore, lcpScore, ttfbScore, inpScore} =
      getWebVitalScoresFromTableDataRow(finalRow);
    return {
      ...finalRow,
      totalScore: totalScore ?? 0,
      clsScore: clsScore ?? 0,
      fcpScore: fcpScore ?? 0,
      lcpScore: lcpScore ?? 0,
      ttfbScore: ttfbScore ?? 0,
      inpScore: inpScore ?? 0,
      'avg(measurements.score.total)': row['performance_score(measurements.score.total)'],
      // Map back opportunity score key so we don't have to handle both keys in the UI
      opportunity:
        row[
          webVital === 'total'
            ? totalOpportunityScoreField
            : (`opportunity_score(measurements.score.${webVital})` as const)
        ],
    };
  });

  const metricsSearch = getMetricsSearch(metricsQuery, browserTypes, deviceType);
  const metricsEnabled = enabled !== false && metricsVital !== undefined;
  // Pageloads. TTFB comes from navigation timing, so every pageload reports it.
  const pageloadsField = webVitalCountField('ttfb');
  const scoreCountField = webVitalScoreCountField(metricsVital ?? 'lcp');
  const scoreField = webVitalScoreField(metricsVital ?? 'lcp');
  const p75Field = webVitalP75Field(metricsVital ?? 'lcp');

  const metrics = useTraceMetrics(
    {
      enabled: metricsEnabled,
      search: metricsSearch,
      limit: limit ?? 50,
      sorts: [{field: scoreCountField, kind: 'desc'}],
      fields: [
        'project.id',
        'project',
        'transaction',
        p75Field,
        scoreField,
        scoreCountField,
        pageloadsField,
      ],
    },
    Referrer.WEB_VITAL_TRANSACTIONS_SCORES
  );
  // The opportunity is each page's missing score over the scores of every page
  const metricsTotals = useTraceMetrics(
    {enabled: metricsEnabled, search: metricsSearch, limit: 1, fields: [scoreCountField]},
    Referrer.WEB_VITAL_TRANSACTIONS_SCORES
  );

  if (metricsQuery !== undefined) {
    const totalCount = Number(metricsTotals.data[0]?.[scoreCountField] ?? 0);
    // Key the rows like the spans rows so callers read one shape
    const metricsData = metrics.data
      .filter(row => Number(row[scoreCountField] ?? 0) > 0)
      .map(row => {
        const count = Number(row[scoreCountField]);
        const ratio = Number(row[scoreField] ?? 0);
        return {
          transaction: row.transaction,
          project: row.project,
          'project.id': row['project.id'],
          [`p75(${WEB_VITAL_TO_FIELD[metricsVital ?? 'lcp']})`]: Number(
            row[p75Field] ?? 0
          ),
          'count()': Number(row[pageloadsField] ?? 0),
          [`count_scores(measurements.score.${metricsVital})`]: count,
          [`${metricsVital}Score`]: Math.round(ratio * 100),
          opportunity: totalCount > 0 ? (count * (1 - ratio)) / totalCount : 0,
        } as (typeof tableData)[number];
      });
    return {
      ...metrics,
      data: metricsData,
      isPending: metrics.isPending || metricsTotals.isPending,
    };
  }

  return {data: tableData, isPending, ...rest};
};
