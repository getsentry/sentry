import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {webVitalP75Field} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import {Referrer} from 'sentry/views/insights/browser/webVitals/referrers';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import {ORDER, WEB_VITAL_TO_FIELD} from 'sentry/views/insights/browser/webVitals/types';
import {
  addBrowserFilter,
  getMetricsSearch,
  type DeviceType,
} from 'sentry/views/insights/browser/webVitals/utils/deviceType';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {
  useSpans,
  useTraceMetrics,
} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields, type SubregionCode} from 'sentry/views/insights/types';

type Props = {
  browserTypes?: BrowserType[];
  deviceType?: DeviceType;
  /** When set, query trace metrics with this search instead of spans. */
  metricsQuery?: string;
  subregions?: SubregionCode[];
  transaction?: string;
};

export const useProjectRawWebVitalsQuery = ({
  transaction,
  browserTypes,
  deviceType,
  subregions,
  metricsQuery,
}: Props = {}) => {
  const isMetrics = metricsQuery !== undefined;
  const search = new MutableSearch([]);
  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  if (subregions?.length) {
    search.addFilterValueList(SpanFields.USER_GEO_SUBREGION, subregions);
  }
  addBrowserFilter(search, browserTypes, deviceType);

  const spans = useSpans(
    {
      enabled: !isMetrics,
      search: [DEFAULT_QUERY_FILTER, search.formatString()].join(' ').trim(),
      limit: 50,
      fields: [
        `p75(${SpanFields.BROWSER_WEB_VITAL_LCP_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_FCP_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_CLS_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_TTFB_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_INP_VALUE})`,
        'count()',
      ],
    },
    Referrer.WEB_VITAL_PROJECT
  );

  const metrics = useTraceMetrics(
    {
      enabled: isMetrics,
      search: getMetricsSearch(metricsQuery, browserTypes, deviceType),
      limit: 1,
      fields: ORDER.map(webVitalP75Field),
    },
    Referrer.WEB_VITAL_PROJECT
  );

  if (!isMetrics) {
    return spans;
  }

  // Key the rows like the spans rows so callers read one shape
  const data = metrics.data.map(
    row =>
      Object.fromEntries(
        ORDER.map(vital => [
          `p75(${WEB_VITAL_TO_FIELD[vital]})`,
          Number(row[webVitalP75Field(vital)] ?? 0),
        ])
      ) as (typeof spans.data)[number]
  );
  return {...metrics, data};
};
