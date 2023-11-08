import {useEffect, useMemo, useState} from 'react';
import {InjectedRouter} from 'react-router';
import moment from 'moment';

import {ApiResult} from 'sentry/api';
import {
  DateTimeObject,
  getDiffInMinutes,
  getInterval,
} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {defined, formatBytesBase2, formatBytesBase10} from 'sentry/utils';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {DateString, PageFilters} from '../types/core';

// TODO(ddm): reuse from types/metrics.tsx
type MetricMeta = {
  mri: string;
  name: string;
  operations: string[];
  type: string;
  unit: string;
};

export enum MetricDisplayType {
  LINE = 'line',
  AREA = 'area',
  BAR = 'bar',
  TABLE = 'table',
}

export const defaultMetricDisplayType = MetricDisplayType.LINE;

export function useMetricsMeta(
  projects: PageFilters['projects']
): Record<string, MetricMeta> {
  const {slug} = useOrganization();
  const getKey = (useCase: UseCase): ApiQueryKey => {
    return [
      `/organizations/${slug}/metrics/meta/`,
      {query: {useCase, project: projects}},
    ];
  };

  const opts = {
    staleTime: Infinity,
  };

  const {data: sessionsMeta = []} = useApiQuery<MetricMeta[]>(getKey('sessions'), opts);
  const {data: txnsMeta = []} = useApiQuery<MetricMeta[]>(getKey('transactions'), opts);
  const {data: customMeta = []} = useApiQuery<MetricMeta[]>(getKey('custom'), opts);

  return useMemo(
    () =>
      [...sessionsMeta, ...txnsMeta, ...customMeta].reduce((acc, metricMeta) => {
        return {...acc, [metricMeta.mri]: metricMeta};
      }, {}),
    [sessionsMeta, txnsMeta, customMeta]
  );
}

type MetricTag = {
  key: string;
};

export function useMetricsTags(mri: string, projects: PageFilters['projects']) {
  const {slug} = useOrganization();
  const {useCase} = parseMRI(mri);
  return useApiQuery<MetricTag[]>(
    [
      `/organizations/${slug}/metrics/tags/`,
      {query: {metric: mri, useCase, project: projects}},
    ],
    {
      staleTime: Infinity,
    }
  );
}

export function useMetricsTagValues(
  mri: string,
  tag: string,
  projects: PageFilters['projects']
) {
  const {slug} = useOrganization();
  const {useCase} = parseMRI(mri);
  return useApiQuery<MetricTag[]>(
    [
      `/organizations/${slug}/metrics/tags/${tag}/`,
      {query: {metric: mri, useCase, project: projects}},
    ],
    {
      staleTime: Infinity,
      enabled: !!tag,
    }
  );
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

// TODO(ddm): reuse from types/metrics.tsx
type Group = {
  by: Record<string, unknown>;
  series: Record<string, number[]>;
  totals: Record<string, number>;
};

// TODO(ddm): reuse from types/metrics.tsx
export type MetricsData = {
  end: string;
  groups: Group[];
  intervals: string[];
  meta: MetricMeta[];
  query: string;
  start: string;
};

export function useMetricsData({
  mri,
  op,
  datetime,
  projects,
  environments,
  query,
  groupBy,
}: MetricsQuery) {
  const {slug, features} = useOrganization();
  const {useCase} = parseMRI(mri);
  const field = op ? `${op}(${mri})` : mri;

  const interval = getMetricsInterval(datetime, mri);

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
    useNewMetricsLayer: false,
  };

  if (features.includes('metrics-api-new-metrics-layer')) {
    queryToSend.useNewMetricsLayer = true;
  }

  return useApiQuery<MetricsData>(
    [`/organizations/${slug}/metrics/data/`, {query: queryToSend}],
    {
      retry: 0,
      staleTime: 0,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      refetchInterval: data => getRefetchInterval(data, interval),
    }
  );
}

function getRefetchInterval(
  data: ApiResult | undefined,
  interval: string
): number | false {
  // no data means request failed - don't refetch
  if (!data) {
    return false;
  }
  if (interval === '10s') {
    // refetch every 10 seconds
    return 10 * 1000;
  }
  // refetch every 60 seconds
  return 60 * 1000;
}

// Wraps useMetricsData and provides two additional features:
// 1. return data is undefined only during the initial load
// 2. provides a callback to trim the data to a specific time range when chart zoom is used
export function useMetricsDataZoom(props: MetricsQuery) {
  const [metricsData, setMetricsData] = useState<MetricsData | undefined>();
  const {data: rawData, isLoading, isError, error} = useMetricsData(props);

  useEffect(() => {
    if (rawData) {
      setMetricsData(rawData);
    }
  }, [rawData]);

  const trimData = (start, end): MetricsData | undefined => {
    if (!metricsData) {
      return metricsData;
    }
    // find the index of the first interval that is greater than the start time
    const startIndex = metricsData.intervals.findIndex(interval => interval >= start) - 1;
    const endIndex = metricsData.intervals.findIndex(interval => interval >= end);

    if (startIndex === -1 || endIndex === -1) {
      return metricsData;
    }

    return {
      ...metricsData,
      intervals: metricsData.intervals.slice(startIndex, endIndex),
      groups: metricsData.groups.map(group => ({
        ...group,
        series: Object.fromEntries(
          Object.entries(group.series).map(([seriesName, series]) => [
            seriesName,
            series.slice(startIndex, endIndex),
          ])
        ),
      })),
    };
  };

  return {
    data: metricsData,
    isLoading,
    isError,
    error,
    onZoom: (start: DateString, end: DateString) => {
      setMetricsData(trimData(start, end));
    },
  };
}

// Wraps getInterval since other users of this function, and other metric use cases do not have support for 10s granularity
function getMetricsInterval(dateTimeObj: DateTimeObject, mri: string) {
  const interval = getInterval(dateTimeObj, 'metrics');

  if (interval !== '1m') {
    return interval;
  }

  const diffInMinutes = getDiffInMinutes(dateTimeObj);
  const {useCase} = parseMRI(mri);

  if (diffInMinutes <= 60 && useCase === 'custom') {
    return '10s';
  }

  return interval;
}

function getDateTimeParams({start, end, period}: PageFilters['datetime']) {
  return period
    ? {statsPeriod: period}
    : {start: moment(start).toISOString(), end: moment(end).toISOString()};
}

type UseCase = 'sessions' | 'transactions' | 'custom';

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

export function parseMRI(mri: string) {
  const cleanMRI = mri.match(/d:[\w/.@]+/)?.[0] ?? mri;

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

function getUseCaseFromMRI(mri?: string): UseCase {
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
