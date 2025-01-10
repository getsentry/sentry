import {useCallback, useRef} from 'react';
import moment from 'moment-timezone';
import * as qs from 'query-string';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import {
  getDiffInMinutes,
  GranularityLadder,
  ONE_HOUR,
  ONE_WEEK,
  SIX_HOURS,
  SIXTY_DAYS,
  THIRTY_DAYS,
  TWENTY_FOUR_HOURS,
  TWO_WEEKS,
} from 'sentry/components/charts/utils';
import {
  normalizeDateTimeParams,
  parseStatsPeriod,
} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {
  MetricAggregation,
  MetricMeta,
  MetricsDataIntervalLadder,
  MetricsQueryApiResponse,
  MetricsQueryApiResponseLastMeta,
  MRI,
  UseCase,
} from 'sentry/types/metrics';
import {isMeasurement} from 'sentry/utils/discover/fields';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import {DEFAULT_AGGREGATES, SPAN_DURATION_MRI} from 'sentry/utils/metrics/constants';
import {formatMRI, formatMRIField, MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import type {
  MetricsQuery,
  MetricsQueryParams,
  MetricsWidget,
} from 'sentry/utils/metrics/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {
  isMetricFormula,
  type MetricsQueryApiQueryParams,
} from 'sentry/utils/metrics/useMetricsQuery';
import useRouter from 'sentry/utils/useRouter';

export function getDefaultMetricDisplayType(
  mri?: MRI,
  aggregation?: MetricAggregation
): MetricDisplayType {
  if (mri?.startsWith('c') || aggregation === 'count') {
    return MetricDisplayType.BAR;
  }
  return MetricDisplayType.LINE;
}

export const getMetricDisplayType = (displayType: unknown): MetricDisplayType => {
  if (
    [MetricDisplayType.AREA, MetricDisplayType.BAR, MetricDisplayType.LINE].includes(
      displayType as MetricDisplayType
    )
  ) {
    return displayType as MetricDisplayType;
  }

  return MetricDisplayType.LINE;
};

export function getMetricsUrl(
  orgSlug: string,
  {
    widgets,
    start,
    end,
    statsPeriod,
    project,
    ...otherParams
  }: Omit<MetricsQueryParams, 'project' | 'widgets'> & {
    widgets: Partial<MetricsWidget>[];
    project?: (string | number)[];
  }
) {
  const urlParams: Partial<MetricsQueryParams> = {
    ...otherParams,
    project: project?.map(id => (typeof id === 'string' ? parseInt(id, 10) : id)),
    widgets: JSON.stringify(widgets),
  };

  if (statsPeriod) {
    urlParams.statsPeriod = statsPeriod;
  } else {
    urlParams.start = start;
    urlParams.end = end;
  }

  return `/organizations/${orgSlug}/metrics/?${qs.stringify(urlParams)}`;
}

const intervalLadders: Record<MetricsDataIntervalLadder, GranularityLadder> = {
  metrics: new GranularityLadder([
    [SIXTY_DAYS, '1d'],
    [THIRTY_DAYS, '2h'],
    [TWO_WEEKS, '1h'],
    [ONE_WEEK, '30m'],
    [TWENTY_FOUR_HOURS, '5m'],
    [ONE_HOUR, '1m'],
    [0, '1m'],
  ]),
  bar: new GranularityLadder([
    [SIXTY_DAYS, '1d'],
    [THIRTY_DAYS, '12h'],
    [TWO_WEEKS, '4h'],
    [ONE_WEEK, '2h'],
    [TWENTY_FOUR_HOURS, '1h'],
    [SIX_HOURS, '30m'],
    [ONE_HOUR, '5m'],
    [0, '1m'],
  ]),
  dashboard: new GranularityLadder([
    [SIXTY_DAYS, '1d'],
    [THIRTY_DAYS, '1h'],
    [TWO_WEEKS, '30m'],
    [ONE_WEEK, '30m'],
    [TWENTY_FOUR_HOURS, '5m'],
    [0, '5m'],
  ]),
};

// Wraps getInterval since other users of this function, and other metric use cases do not have support for 10s granularity
export function getMetricsInterval(
  datetimeObj: DateTimeObject,
  useCase: UseCase,
  ladder: MetricsDataIntervalLadder = 'metrics'
) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes <= ONE_HOUR && useCase === 'custom' && ladder === 'metrics') {
    return '10s';
  }

  return intervalLadders[ladder].getInterval(diffInMinutes);
}

export function getDateTimeParams({start, end, period}: PageFilters['datetime']) {
  return period
    ? {statsPeriod: period}
    : {start: moment(start).toISOString(), end: moment(end).toISOString()};
}

export function getDefaultAggregation(mri: MRI): MetricAggregation {
  const parsedMRI = parseMRI(mri);

  const fallbackAggregate = 'sum';

  if (!parsedMRI) {
    return fallbackAggregate;
  }

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return DEFAULT_AGGREGATES[parsedMRI.type] || fallbackAggregate;
}

// Using Records to ensure all MetricAggregations are covered
const metricAggregationsCheck: Record<MetricAggregation, boolean> = {
  count: true,
  count_unique: true,
  sum: true,
  avg: true,
  min: true,
  max: true,
  p50: true,
  p75: true,
  p90: true,
  p95: true,
  p99: true,
};

export function isMetricsAggregation(value: string): value is MetricAggregation {
  return !!metricAggregationsCheck[value as MetricAggregation];
}

export function isAllowedAggregation(aggregation: MetricAggregation) {
  return !['max_timestamp', 'min_timestamp', 'histogram'].includes(aggregation);
}

// Applying these aggregations to a metric will result in a timeseries whose scale is different than
// the original metric.
export function isCumulativeAggregation(aggregation: MetricAggregation) {
  return ['sum', 'count', 'count_unique'].includes(aggregation);
}

function updateQuery(
  router: InjectedRouter,
  partialQuery: Record<string, any>,
  options?: {replace: boolean}
) {
  const updateFunction = options?.replace ? router.replace : router.push;
  updateFunction({
    ...router.location,
    query: {
      ...router.location.query,
      ...partialQuery,
    },
  });
}

export function clearQuery(router: InjectedRouter) {
  router.push({
    ...router.location,
    query: {},
  });
}

export function useInstantRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export function useUpdateQuery() {
  const router = useRouter();
  // Store the router in a ref so that we can use it in the callback
  // without needing to generate a new callback every time the location changes
  const routerRef = useInstantRef(router);
  return useCallback(
    (partialQuery: Record<string, any>, options?: {replace: boolean}) => {
      updateQuery(routerRef.current, partialQuery, options);
    },
    [routerRef]
  );
}

export function useClearQuery() {
  const router = useRouter();
  // Store the router in a ref so that we can use it in the callback
  // without needing to generate a new callback every time the location changes
  const routerRef = useInstantRef(router);
  return useCallback(() => {
    clearQuery(routerRef.current);
  }, [routerRef]);
}

export function unescapeMetricsFormula(formula: string) {
  // Remove the $ from variable names
  return formula.replaceAll('$', '');
}

export function getMetricsSeriesName(
  query: MetricsQueryApiQueryParams,
  groupBy?: Record<string, string>,
  isMultiQuery: boolean = true
) {
  let name = getMetricQueryName(query);

  if (isMultiQuery) {
    name = `${query.name}: ${name}`;
  }

  const groupByEntries = Object.entries(groupBy ?? {});

  if (!groupByEntries || !groupByEntries.length) {
    return name;
  }

  const formattedGrouping = groupByEntries
    .map(([_key, value]) => `${String(value).length ? value : t('(none)')}`)
    .join(', ');

  if (isMultiQuery) {
    return `${name} - ${formattedGrouping}`;
  }
  return formattedGrouping;
}

export function getMetricQueryName(query: MetricsQueryApiQueryParams): string {
  return (
    query.alias ??
    (isMetricFormula(query)
      ? unescapeMetricsFormula(query.formula)
      : formatMRIField(MRIToField(query.mri, query.aggregation)))
  );
}

export function getMetricsSeriesId(
  query: MetricsQueryApiQueryParams,
  groupBy?: Record<string, string>
) {
  if (Object.keys(groupBy ?? {}).length === 0) {
    return `${query.name}`;
  }
  return `${query.name}-${JSON.stringify(groupBy)}`;
}

export function groupByOp(metrics: MetricMeta[]): Record<string, MetricMeta[]> {
  const uniqueOperations = [
    ...new Set(metrics.flatMap(field => field.operations).filter(isAllowedAggregation)),
  ].sort();

  const groupedByAggregation = uniqueOperations.reduce((result, aggregation) => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    result[aggregation] = metrics.filter(field => field.operations.includes(aggregation));
    return result;
  }, {});

  return groupedByAggregation;
}

export function isTransactionMeasurement({mri}: {mri: MRI}) {
  const {name} = parseMRI(mri) ?? {name: ''};
  return isMeasurement(name);
}

export function isSpanMeasurement({mri}: {mri: MRI}) {
  if (
    mri === 'd:spans/http.response_content_length@byte' ||
    mri === 'd:spans/http.decoded_response_content_length@byte' ||
    mri === 'd:spans/http.response_transfer_size@byte'
  ) {
    return true;
  }

  const parsedMRI = parseMRI(mri);
  if (
    parsedMRI &&
    parsedMRI.useCase === 'spans' &&
    parsedMRI.name.startsWith('webvital.')
  ) {
    return true;
  }

  return false;
}

export function isCustomMeasurement({mri}: {mri: MRI}) {
  const DEFINED_MEASUREMENTS = new Set(Object.keys(getMeasurements()));

  const {name} = parseMRI(mri) ?? {name: ''};
  return !DEFINED_MEASUREMENTS.has(name) && isMeasurement(name);
}

export function isStandardMeasurement({mri}: {mri: MRI}) {
  return isTransactionMeasurement({mri}) && !isCustomMeasurement({mri});
}

export function isTransactionDuration({mri}: {mri: MRI}) {
  return mri === 'd:transactions/duration@millisecond';
}

export function isCustomMetric({mri}: {mri: MRI}) {
  return mri.includes(':custom/');
}

export function isPerformanceMetric({mri}: {mri: MRI}) {
  return mri.includes(':spans/') || mri.includes(':transactions/');
}

export function isVirtualMetric({mri}: {mri: MRI}) {
  return mri.startsWith('v:');
}

export function isCounterMetric({mri}: {mri: MRI}) {
  return mri.startsWith('c:');
}

export function isSpanDuration({mri}: {mri: MRI}) {
  return mri === SPAN_DURATION_MRI;
}

export function getFieldFromMetricsQuery(metricsQuery: MetricsQuery) {
  if (isCustomMetric(metricsQuery)) {
    return MRIToField(metricsQuery.mri, metricsQuery.aggregation);
  }

  return formatMRIField(MRIToField(metricsQuery.mri, metricsQuery.aggregation));
}

export function getFormattedMQL({
  mri,
  aggregation,
  query,
  groupBy,
}: MetricsQuery): string {
  if (!aggregation) {
    return '';
  }

  let result = `${aggregation}(${formatMRI(mri)})`;

  if (query) {
    result += `{${query.trim()}}`;
  }

  if (groupBy?.length) {
    result += ` by ${groupBy.join(', ')}`;
  }

  return result;
}

export function isFormattedMQL(mql: string) {
  const regex = /^(\w+\([\w\.]+\))(?:\{\w+\:\w+\})*(?:\sby\s\w+)*/;

  const matches = mql.match(regex);

  const [, field, query, groupBy] = matches ?? [];

  if (!field) {
    return false;
  }

  if (query) {
    return query.includes(':');
  }

  if (groupBy) {
    // TODO check groupbys
  }

  return true;
}

// TODO: consider moving this to utils/dates.tsx
export function getAbsoluteDateTimeRange(params: PageFilters['datetime']) {
  const {start, end, statsPeriod, utc} = normalizeDateTimeParams(params, {
    allowAbsoluteDatetime: true,
  });

  if (start && end) {
    return {start: moment(start).toISOString(), end: moment(end).toISOString()};
  }

  const parsedStatusPeriod = parseStatsPeriod(statsPeriod || '24h');

  const now = utc ? moment().utc() : moment();

  if (!parsedStatusPeriod) {
    // Default to 24h
    return {start: moment(now).subtract(1, 'day').toISOString(), end: now.toISOString()};
  }

  const startObj = moment(now).subtract(
    parsedStatusPeriod.period,
    parsedStatusPeriod.periodLength
  );

  return {start: startObj.toISOString(), end: now.toISOString()};
}

export function areResultsLimited(response: MetricsQueryApiResponse) {
  return response.meta.some(
    meta => (meta[meta.length - 1] as MetricsQueryApiResponseLastMeta).has_more
  );
}

export function isNotQueryOnly(query: MetricsQueryApiQueryParams) {
  return !('isQueryOnly' in query) || !query.isQueryOnly;
}
