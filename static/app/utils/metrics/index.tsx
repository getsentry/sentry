import {InjectedRouter} from 'react-router';
import moment from 'moment';
import * as qs from 'query-string';

import {
  DateTimeObject,
  getDiffInMinutes,
  getInterval,
} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {
  MetricsApiRequestMetric,
  MetricsApiRequestQuery,
  MetricsGroup,
} from 'sentry/types/metrics';
import {defined, formatBytesBase2, formatBytesBase10} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';

import {DateString, PageFilters} from '../../types/core';

export enum MetricDisplayType {
  LINE = 'line',
  AREA = 'area',
  BAR = 'bar',
  TABLE = 'table',
}

export const defaultMetricDisplayType = MetricDisplayType.LINE;

export type UseCase = 'sessions' | 'transactions' | 'custom';

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
  mri: string;
  projects: PageFilters['projects'];
  groupBy?: string[];
  op?: string;
  query?: string;
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
  const useCase = getUseCaseFromMRI(fieldToMri(field).mri);
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
    per_page: 20,
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

const metricTypeToReadable = {
  c: t('counter'),
  g: t('gauge'),
  d: t('distribution'),
  s: t('set'),
  e: t('derived'),
};

// Converts from "c" to "counter"
export function getReadableMetricType(type) {
  return metricTypeToReadable[type] ?? t('unknown');
}

const noUnit = 'none';

export function parseMRI(mri?: string) {
  if (!mri) {
    return null;
  }

  const cleanMRI = mri.match(/[cdegs]:[\w/.@]+/)?.[0] ?? mri;

  const name = cleanMRI.match(/^[a-z]:\w+\/(.+)(?:@\w+)$/)?.[1] ?? mri;
  const unit = cleanMRI.split('@').pop() ?? noUnit;

  const useCase = getUseCaseFromMRI(cleanMRI);

  return {
    name,
    unit,

    mri: cleanMRI,
    useCase,
  };
}

export function getUseCaseFromMRI(mri?: string): UseCase {
  if (mri?.includes('custom/')) {
    return 'custom';
  }
  if (mri?.includes('transactions/')) {
    return 'transactions';
  }
  return 'sessions';
}

export function formatMetricUsingUnit(value: number | null, unit: string) {
  if (!defined(value)) {
    return '\u2014';
  }

  switch (unit) {
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
    const mri = Object.keys(group.series)?.[0];
    const parsed = parseMRI(mri);

    return parsed?.name ?? '(none)';
  }

  return Object.entries(group.by)
    .map(([key, value]) => `${key}:${String(value).length ? value : t('none')}`)
    .join(', ');
}

export function mriToField(mri: string, op: string): string {
  return `${op}(${mri})`;
}

export function fieldToMri(field: string): {mri?: string; op?: string} {
  const parsedFunction = parseFunction(field);
  if (!parsedFunction) {
    // We only allow aggregate functions for custom metric alerts
    return {};
  }
  return {
    mri: parsedFunction.arguments[0],
    op: parsedFunction.name,
  };
}

// This is a workaround as the alert builder requires a valid aggregate to be set
export const DEFAULT_METRIC_ALERT_AGGREGATE = 'sum(c:custom/iolnqzyenoqugwm@none)';

export const formatMriAggregate = (aggregate: string) => {
  if (aggregate === DEFAULT_METRIC_ALERT_AGGREGATE) {
    return t('Select a metric to get started');
  }

  const {mri, op} = fieldToMri(aggregate);
  const parsed = parseMRI(mri);

  // The field does not contain an MRI -> return the aggregate as is
  if (!parsed) {
    return aggregate;
  }

  const {name} = parsed;

  return `${op}(${name})`;
};
