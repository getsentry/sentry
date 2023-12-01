import {InjectedRouter} from 'react-router';
import round from 'lodash/round';
import moment from 'moment';
import * as qs from 'query-string';

import {
  DateTimeObject,
  getDiffInMinutes,
  getInterval,
} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {MetricsApiResponse} from 'sentry/types';
import {
  MetricMeta,
  MetricsApiRequestMetric,
  MetricsApiRequestQuery,
  MetricsGroup,
  MetricType,
  MRI,
  UseCase,
} from 'sentry/types/metrics';
import {defined, formatBytesBase2, formatBytesBase10} from 'sentry/utils';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';
import {formatMRI, getUseCaseFromMRI, parseField} from 'sentry/utils/metrics/mri';

import {DateString, PageFilters} from '../../types/core';

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

export interface MetricWidgetQueryParams
  extends Pick<MetricsQuery, 'mri' | 'op' | 'query' | 'groupBy'> {
  displayType: MetricDisplayType;
  focusedSeries?: string;
  position?: number;
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
};

export type MetricMetaCodeLocation = {
  frames: {
    absPath?: string;
    filename?: string;
    function?: string;
    lineNo?: number;
    module?: string;
  }[];
  mri: string;
  timestamp: number;
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
  overrides: Partial<MetricsApiRequestQuery>
): MetricsApiRequestQuery {
  const {mri: mri} = parseField(field) ?? {};
  const useCase = getUseCaseFromMRI(mri) ?? 'custom';
  const interval = getMetricsInterval(datetime, useCase);

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

// Wraps getInterval since other users of this function, and other metric use cases do not have support for 10s granularity
export function getMetricsInterval(dateTimeObj: DateTimeObject, useCase: UseCase) {
  const interval = getInterval(dateTimeObj, 'metrics');

  if (interval !== '1m') {
    return interval;
  }

  const diffInMinutes = getDiffInMinutes(dateTimeObj);

  if (diffInMinutes <= 60 && useCase === 'custom') {
    return '10s';
  }

  return interval;
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

export function formatMetricUsingUnit(value: number | null, unit: string) {
  if (!defined(value)) {
    return '\u2014';
  }

  switch (unit as FormattingSupportedMetricUnit) {
    case 'nanosecond':
      return getDuration(value / 1000000000, 2, true);
    case 'microsecond':
      return getDuration(value / 1000000, 2, true);
    case 'millisecond':
      return getDuration(value / 1000, 2, true);
    case 'second':
      return getDuration(value, 2, true);
    case 'minute':
      return getDuration(value * 60, 2, true);
    case 'hour':
      return getDuration(value * 60 * 60, 2, true);
    case 'day':
      return getDuration(value * 60 * 60 * 24, 2, true);
    case 'week':
      return getDuration(value * 60 * 60 * 24 * 7, 2, true);
    case 'ratio':
      return formatPercentage(value, 2);
    case 'percent':
      return formatPercentage(value / 100, 2);
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

const getShortMetricUnit = (unit: string): string => METRIC_UNIT_TO_SHORT[unit] ?? '';

export function formatMetricUsingFixedUnit(
  value: number | null,
  unit: string,
  op?: string
) {
  if (value === null) {
    return '\u2014';
  }

  return op === 'count'
    ? round(value, 3).toLocaleString()
    : `${round(value, 3).toLocaleString()}${getShortMetricUnit(unit)}`.trim();
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

export function updateQuery(router: InjectedRouter, partialQuery: Record<string, any>) {
  router.push({
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
