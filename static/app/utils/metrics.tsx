import {useMemo} from 'react';
import moment from 'moment';

import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {defined, formatBytesBase2, formatBytesBase10} from 'sentry/utils';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {PageFilters} from '../types/core';

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

export function useMetricsMeta(): Record<string, MetricMeta> {
  const {slug} = useOrganization();
  const getKey = (useCase: UseCase): ApiQueryKey => {
    return [`/organizations/${slug}/metrics/meta/`, {query: {useCase}}];
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

export function useMetricsTags(mri: string) {
  const {slug} = useOrganization();
  const useCase = getUseCaseFromMri(mri);
  return useApiQuery<MetricTag[]>(
    [`/organizations/${slug}/metrics/tags/`, {query: {metric: mri, useCase}}],
    {
      staleTime: Infinity,
    }
  );
}

export function useMetricsTagValues(mri: string, tag: string) {
  const {slug} = useOrganization();
  const useCase = getUseCaseFromMri(mri);
  return useApiQuery<MetricTag[]>(
    [`/organizations/${slug}/metrics/tags/${tag}`, {query: {useCase}}],
    {
      staleTime: Infinity,
      enabled: !!tag,
    }
  );
}

export type MetricsDataProps = {
  datetime: PageFilters['datetime'];
  mri: string;
  groupBy?: string[];
  op?: string;
  projects?: string[];
  queryString?: string;
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
  queryString,
  groupBy,
}: MetricsDataProps) {
  const {slug} = useOrganization();
  const useCase = getUseCaseFromMri(mri);
  const field = op ? `${op}(${mri})` : mri;

  const query = getQueryString({projects, queryString});

  const interval = getInterval(datetime, 'metrics');

  const queryToSend = {
    ...getDateTimeParams(datetime),
    field,
    useCase,
    interval,
    query,
    groupBy,

    // max result groups
    per_page: 20,
  };

  return useApiQuery<MetricsData>(
    [`/organizations/${slug}/metrics/data/`, {query: queryToSend}],
    {
      retry: 0,
      staleTime: 0,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      // auto refetch every 60 seconds
      refetchInterval: data => {
        // don't refetch if the request failed
        if (!data) {
          return false;
        }
        return 60 * 1000;
      },
    }
  );
}

function getDateTimeParams({start, end, period}: PageFilters['datetime']) {
  return period
    ? {statsPeriod: period}
    : {start: moment(start).toISOString(), end: moment(end).toISOString()};
}

function getQueryString({
  projects = [],
  queryString = '',
}: Pick<MetricsDataProps, 'projects' | 'queryString'>): string {
  const projectQuery = projects.length ? `project:[${projects}]` : '';
  return [projectQuery, queryString].join(' ');
}

type UseCase = 'sessions' | 'transactions' | 'custom';

export function getUseCaseFromMri(mri?: string): UseCase {
  if (mri?.includes('custom')) {
    return 'custom';
  }
  if (mri?.includes('transactions')) {
    return 'transactions';
  }
  return 'sessions';
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

export function getUnitFromMRI(mri?: string) {
  if (!mri) {
    return noUnit;
  }

  return mri.split('@').pop() ?? noUnit;
}

export function getNameFromMRI(mri: string) {
  return mri.match(/^[a-z]:\w+\/(.+)(?:@\w+)$/)?.[1] ?? mri;
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
