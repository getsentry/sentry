import {useCallback, useRef} from 'react';
import {InjectedRouter} from 'react-router';
import moment from 'moment';
import * as qs from 'query-string';

import {
  DateTimeObject,
  Fidelity,
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
import {t} from 'sentry/locale';
import {MetricsApiResponse} from 'sentry/types';
import {
  MetricMeta,
  MetricsApiRequestMetric,
  MetricsApiRequestQuery,
  MetricsApiRequestQueryOptions,
  MetricsGroup,
  MetricType,
  MRI,
  UseCase,
} from 'sentry/types/metrics';
import {defined, formatBytesBase2, formatBytesBase10} from 'sentry/utils';
import {isMeasurement as isMeasurementName} from 'sentry/utils/discover/fields';
import {
  DAY,
  formatNumberWithDynamicDecimalPoints,
  HOUR,
  MINUTE,
  MONTH,
  SECOND,
  WEEK,
} from 'sentry/utils/formatters';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import {
  formatMRI,
  formatMRIField,
  getUseCaseFromMRI,
  MRIToField,
  parseField,
  parseMRI,
} from 'sentry/utils/metrics/mri';
import useRouter from 'sentry/utils/useRouter';

import {DateString, PageFilters} from '../../types/core';

export const METRICS_DOCS_URL =
  'https://develop.sentry.dev/delightful-developer-metrics/';

export enum MetricDisplayType {
  LINE = 'line',
  AREA = 'area',
  BAR = 'bar',
  TABLE = 'table',
}

export const defaultMetricDisplayType = MetricDisplayType.LINE;

export const getMetricDisplayType = (displayType: unknown): MetricDisplayType => {
  if (
    [
      MetricDisplayType.AREA,
      MetricDisplayType.BAR,
      MetricDisplayType.LINE,
      MetricDisplayType.TABLE,
    ].includes(displayType as MetricDisplayType)
  ) {
    return displayType as MetricDisplayType;
  }

  return MetricDisplayType.LINE;
};

export type MetricTag = {
  key: string;
};

export type SortState = {
  name: 'name' | 'avg' | 'min' | 'max' | 'sum' | undefined;
  order: 'asc' | 'desc';
};

export interface MetricWidgetQueryParams extends MetricsQuerySubject {
  displayType: MetricDisplayType;
  focusedSeries?: string;
  powerUserMode?: boolean;
  showSummaryTable?: boolean;
  sort?: SortState;
}

export interface DdmQueryParams {
  widgets: string; // stringified json representation of MetricWidgetQueryParams
  end?: DateString;
  environment?: string[];
  project?: number[];
  start?: DateString;
  statsPeriod?: string | null;
  utc?: boolean | null;
}

export type MetricsQuery = {
  datetime: PageFilters['datetime'];
  environments: PageFilters['environments'];
  mri: MRI;
  projects: PageFilters['projects'];
  groupBy?: string[];
  op?: string;
  query?: string;
  title?: string;
};

export type MetricsQuerySubject = Pick<
  MetricsQuery,
  'mri' | 'op' | 'query' | 'groupBy' | 'title'
>;

export type MetricCodeLocationFrame = {
  absPath?: string;
  contextLine?: string;
  filename?: string;
  function?: string;
  lineNo?: number;
  module?: string;
  platform?: string;
  postContext?: string[];
  preContext?: string[];
};

export type MetricMetaCodeLocation = {
  mri: string;
  timestamp: number;
  codeLocations?: MetricCodeLocationFrame[];
  frames?: MetricCodeLocationFrame[];
  metricSpans?: any[];
};

export type MetricRange = {
  end?: DateString;
  max?: number;
  min?: number;
  start?: DateString;
};

export function getDdmUrl(
  orgSlug: string,
  {
    widgets,
    start,
    end,
    statsPeriod,
    project,
    ...otherParams
  }: Omit<DdmQueryParams, 'project' | 'widgets'> & {
    widgets: MetricWidgetQueryParams[];
    project?: (string | number)[];
  }
) {
  const urlParams: Partial<DdmQueryParams> = {
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

  return `/organizations/${orgSlug}/ddm/?${qs.stringify(urlParams)}`;
}

export function getMetricsApiRequestQuery(
  {field, query, groupBy}: MetricsApiRequestMetric,
  {projects, environments, datetime}: PageFilters,
  overrides: Partial<MetricsApiRequestQueryOptions>
): MetricsApiRequestQuery {
  const {mri: mri} = parseField(field) ?? {};
  const useCase = getUseCaseFromMRI(mri) ?? 'custom';
  const interval = getDDMInterval(datetime, useCase, overrides.fidelity);

  const queryToSend = {
    ...getDateTimeParams(datetime),
    query,
    project: projects,
    environment: environments,
    field,
    useCase,
    interval,
    groupBy,
    allowPrivate: true, // TODO(ddm): reconsider before widening audience
    // max result groups
    per_page: 10,
  };

  return {...queryToSend, ...overrides};
}

const ddmHighFidelityLadder = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '2h'],
  [TWO_WEEKS, '1h'],
  [ONE_WEEK, '30m'],
  [TWENTY_FOUR_HOURS, '5m'],
  [ONE_HOUR, '1m'],
  [0, '5m'],
]);

const ddmLowFidelityLadder = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '12h'],
  [TWO_WEEKS, '4h'],
  [ONE_WEEK, '2h'],
  [TWENTY_FOUR_HOURS, '1h'],
  [SIX_HOURS, '30m'],
  [ONE_HOUR, '5m'],
  [0, '1m'],
]);

// Wraps getInterval since other users of this function, and other metric use cases do not have support for 10s granularity
export function getDDMInterval(
  datetimeObj: DateTimeObject,
  useCase: UseCase,
  fidelity: Fidelity = 'high'
) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes <= ONE_HOUR && useCase === 'custom' && fidelity === 'high') {
    return '10s';
  }

  if (fidelity === 'low') {
    return ddmLowFidelityLadder.getInterval(diffInMinutes);
  }

  return ddmHighFidelityLadder.getInterval(diffInMinutes);
}

export function getDateTimeParams({start, end, period}: PageFilters['datetime']) {
  return period
    ? {statsPeriod: period}
    : {start: moment(start).toISOString(), end: moment(end).toISOString()};
}

const metricTypeToReadable: Record<MetricType, string> = {
  c: t('counter'),
  g: t('gauge'),
  d: t('distribution'),
  s: t('set'),
  e: t('derived'),
};

// Converts from "c" to "counter"
export function getReadableMetricType(type?: string) {
  return metricTypeToReadable[type as MetricType] ?? t('unknown');
}

const MILLISECOND = 1;
const MICROSECOND = MILLISECOND / 1000;

export function formatDuration(seconds: number): string {
  if (!seconds) {
    return '0ms';
  }
  const absValue = Math.abs(seconds * 1000);
  // value in milliseconds
  const msValue = seconds * 1000;

  let unit: FormattingSupportedMetricUnit | 'month' = 'nanosecond';
  let value = msValue * 1000000;

  if (absValue >= MONTH) {
    unit = 'month';
    value = msValue / MONTH;
  } else if (absValue >= WEEK) {
    unit = 'week';
    value = msValue / WEEK;
  } else if (absValue >= DAY) {
    unit = 'day';
    value = msValue / DAY;
  } else if (absValue >= HOUR) {
    unit = 'hour';
    value = msValue / HOUR;
  } else if (absValue >= MINUTE) {
    unit = 'minute';
    value = msValue / MINUTE;
  } else if (absValue >= SECOND) {
    unit = 'second';
    value = msValue / SECOND;
  } else if (absValue >= MILLISECOND) {
    unit = 'millisecond';
    value = msValue;
  } else if (absValue >= MICROSECOND) {
    unit = 'microsecond';
    value = msValue * 1000;
  }

  return `${formatNumberWithDynamicDecimalPoints(value)}${
    unit === 'month' ? 'mo' : METRIC_UNIT_TO_SHORT[unit]
  }`;
}

// The metric units that we have support for in the UI
// others will still be displayed, but will not have any effect on formatting
export const formattingSupportedMetricUnits = [
  'none',
  'nanosecond',
  'microsecond',
  'millisecond',
  'second',
  'minute',
  'hour',
  'day',
  'week',
  'ratio',
  'percent',
  'bit',
  'byte',
  'kibibyte',
  'kilobyte',
  'mebibyte',
  'megabyte',
  'gibibyte',
  'gigabyte',
  'tebibyte',
  'terabyte',
  'pebibyte',
  'petabyte',
  'exbibyte',
  'exabyte',
] as const;

type FormattingSupportedMetricUnit = (typeof formattingSupportedMetricUnits)[number];

const METRIC_UNIT_TO_SHORT: Record<FormattingSupportedMetricUnit, string> = {
  nanosecond: 'ns',
  microsecond: 'μs',
  millisecond: 'ms',
  second: 's',
  minute: 'min',
  hour: 'hr',
  day: 'day',
  week: 'wk',
  ratio: '%',
  percent: '%',
  bit: 'b',
  byte: 'B',
  kibibyte: 'KiB',
  kilobyte: 'KB',
  mebibyte: 'MiB',
  megabyte: 'MB',
  gibibyte: 'GiB',
  gigabyte: 'GB',
  tebibyte: 'TiB',
  terabyte: 'TB',
  pebibyte: 'PiB',
  petabyte: 'PB',
  exbibyte: 'EiB',
  exabyte: 'EB',
  none: '',
};

export function formatMetricUsingUnit(value: number | null, unit: string) {
  if (!defined(value)) {
    return '\u2014';
  }

  switch (unit as FormattingSupportedMetricUnit) {
    case 'nanosecond':
      return formatDuration(value / 1000000000);
    case 'microsecond':
      return formatDuration(value / 1000000);
    case 'millisecond':
      return formatDuration(value / 1000);
    case 'second':
      return formatDuration(value);
    case 'minute':
      return formatDuration(value * 60);
    case 'hour':
      return formatDuration(value * 60 * 60);
    case 'day':
      return formatDuration(value * 60 * 60 * 24);
    case 'week':
      return formatDuration(value * 60 * 60 * 24 * 7);
    case 'ratio':
      return `${formatNumberWithDynamicDecimalPoints(value * 100)}%`;
    case 'percent':
      return `${formatNumberWithDynamicDecimalPoints(value)}%`;
    case 'bit':
      return formatBytesBase2(value / 8);
    case 'byte':
      return formatBytesBase10(value);
    case 'kibibyte':
      return formatBytesBase2(value * 1024);
    case 'kilobyte':
      return formatBytesBase10(value, 1);
    case 'mebibyte':
      return formatBytesBase2(value * 1024 ** 2);
    case 'megabyte':
      return formatBytesBase10(value, 2);
    case 'gibibyte':
      return formatBytesBase2(value * 1024 ** 3);
    case 'gigabyte':
      return formatBytesBase10(value, 3);
    case 'tebibyte':
      return formatBytesBase2(value * 1024 ** 4);
    case 'terabyte':
      return formatBytesBase10(value, 4);
    case 'pebibyte':
      return formatBytesBase2(value * 1024 ** 5);
    case 'petabyte':
      return formatBytesBase10(value, 5);
    case 'exbibyte':
      return formatBytesBase2(value * 1024 ** 6);
    case 'exabyte':
      return formatBytesBase10(value, 6);
    case 'none':
    default:
      return value.toLocaleString();
  }
}

const getShortMetricUnit = (unit: string): string => METRIC_UNIT_TO_SHORT[unit] ?? '';

export function formatMetricUsingFixedUnit(
  value: number | null,
  unit: string,
  op?: string
) {
  if (value === null) {
    return '\u2014';
  }

  const formattedNumber = formatNumberWithDynamicDecimalPoints(value);

  return op === 'count'
    ? formattedNumber
    : `${formattedNumber}${getShortMetricUnit(unit)}`.trim();
}

export function formatMetricsUsingUnitAndOp(
  value: number | null,
  unit: string,
  operation?: string
) {
  if (operation === 'count') {
    // if the operation is count, we want to ignore the unit and always format the value as a number
    return value?.toLocaleString() ?? '';
  }
  return formatMetricUsingUnit(value, unit);
}

export function isAllowedOp(op: string) {
  return !['max_timestamp', 'min_timestamp', 'histogram'].includes(op);
}

export function updateQuery(
  router: InjectedRouter,
  queryUpdater:
    | Record<string, any>
    | ((query: Record<string, any>) => Record<string, any>)
) {
  router.push({
    ...router.location,
    query: {
      ...router.location.query,
      ...queryUpdater,
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
    (partialQuery: Record<string, any>) => {
      updateQuery(routerRef.current, partialQuery);
    },
    [routerRef]
  );
}

// TODO(ddm): there has to be a nicer way to do this
export function getSeriesName(
  group: MetricsGroup,
  isOnlyGroup = false,
  groupBy: MetricsQuery['groupBy']
) {
  if (isOnlyGroup && !groupBy?.length) {
    const field = Object.keys(group.series)?.[0];
    const {mri} = parseField(field) ?? {mri: field};
    const name = formatMRI(mri as MRI);

    return name ?? '(none)';
  }

  return Object.entries(group.by)
    .map(([key, value]) => `${key}:${String(value).length ? value : t('none')}`)
    .join(', ');
}

export function groupByOp(metrics: MetricMeta[]): Record<string, MetricMeta[]> {
  const uniqueOperations = [
    ...new Set(metrics.flatMap(field => field.operations).filter(isAllowedOp)),
  ].sort();

  const groupedByOp = uniqueOperations.reduce((result, op) => {
    result[op] = metrics.filter(field => field.operations.includes(op));
    return result;
  }, {});

  return groupedByOp;
}

export function isMeasurement({mri}: {mri: MRI}) {
  const {name} = parseMRI(mri) ?? {name: ''};
  return isMeasurementName(name);
}

export function isCustomMeasurement({mri}: {mri: MRI}) {
  const DEFINED_MEASUREMENTS = new Set(Object.keys(getMeasurements()));

  const {name} = parseMRI(mri) ?? {name: ''};
  return !DEFINED_MEASUREMENTS.has(name) && isMeasurementName(name);
}

export function isStandardMeasurement({mri}: {mri: MRI}) {
  return isMeasurement({mri}) && !isCustomMeasurement({mri});
}

export function isTransactionDuration({mri}: {mri: MRI}) {
  return mri === 'd:transactions/duration@millisecond';
}

export function isCustomMetric({mri}: {mri: MRI}) {
  return mri.includes(':custom/');
}

export function getFieldFromMetricsQuery(metricsQuery: MetricsQuery) {
  if (isCustomMetric(metricsQuery)) {
    return MRIToField(metricsQuery.mri, metricsQuery.op!);
  }

  return formatMRIField(MRIToField(metricsQuery.mri, metricsQuery.op!));
}

// TODO(ddm): remove this and all of its usages once backend sends mri fields
export function mapToMRIFields(
  data: MetricsApiResponse | undefined,
  fields: string[]
): void {
  if (!data) {
    return;
  }

  data.groups.forEach(group => {
    group.series = swapObjectKeys(group.series, fields);
    group.totals = swapObjectKeys(group.totals, fields);
  });
}

function swapObjectKeys(obj: Record<string, unknown> | undefined, newKeys: string[]) {
  if (!obj) {
    return {};
  }

  return Object.keys(obj).reduce((acc, key, index) => {
    acc[newKeys[index]] = obj[key];
    return acc;
  }, {});
}

export function stringifyMetricWidget(metricWidget: MetricsQuerySubject): string {
  const {mri, op, query, groupBy} = metricWidget;

  if (!op) {
    return '';
  }

  let result = `${op}(${formatMRI(mri)})`;

  if (query) {
    result += `{${query.trim()}}`;
  }

  if (groupBy && groupBy.length) {
    result += ` by ${groupBy.join(', ')}`;
  }

  return result;
}
