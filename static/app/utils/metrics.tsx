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
import {
  MetricsApiRequestMetric,
  MetricsApiRequestQuery,
  MetricsApiResponse,
  MetricsGroup,
} from 'sentry/types/metrics';
import {defined, formatBytesBase2, formatBytesBase10} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
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

interface Options {
  useCases?: UseCase[];
}

export enum MetricDisplayType {
  LINE = 'line',
  AREA = 'area',
  BAR = 'bar',
  TABLE = 'table',
}

export const defaultMetricDisplayType = MetricDisplayType.LINE;

const DEFAULT_USE_CASES = ['sessions', 'transactions', 'custom'];

export function useMetricsMeta(
  projects: PageFilters['projects'],
  options?: Options
): {data: Record<string, MetricMeta>; isLoading: boolean} {
  const {slug} = useOrganization();
  const enabledUseCases = options?.useCases ?? DEFAULT_USE_CASES;

  const getKey = (useCase: UseCase): ApiQueryKey => {
    return [
      `/organizations/${slug}/metrics/meta/`,
      {query: {useCase, project: projects}},
    ];
  };

  const commonOptions = {
    staleTime: Infinity,
  };

  const sessionsMeta = useApiQuery<MetricMeta[]>(getKey('sessions'), {
    ...commonOptions,
    enabled: enabledUseCases.includes('sessions'),
  });
  const txnsMeta = useApiQuery<MetricMeta[]>(getKey('transactions'), {
    ...commonOptions,
    enabled: enabledUseCases.includes('transactions'),
  });
  const customMeta = useApiQuery<MetricMeta[]>(getKey('custom'), {
    ...commonOptions,
    enabled: enabledUseCases.includes('custom'),
  });

  const combinedMeta = useMemo<Record<string, MetricMeta>>(() => {
    return [
      ...(sessionsMeta.data ?? []),
      ...(txnsMeta.data ?? []),
      ...(customMeta.data ?? []),
    ].reduce((acc, metricMeta) => {
      return {...acc, [metricMeta.mri]: metricMeta};
    }, {});
  }, [sessionsMeta.data, txnsMeta.data, customMeta.data]);

  return {
    data: combinedMeta,
    isLoading: sessionsMeta.isLoading || txnsMeta.isLoading || customMeta.isLoading,
  };
}

type MetricTag = {
  key: string;
};

export function useMetricsTags(
  mri: string | undefined,
  projects: PageFilters['projects']
) {
  const {slug} = useOrganization();
  const useCase = getUseCaseFromMRI(mri || '');
  return useApiQuery<MetricTag[]>(
    [
      `/organizations/${slug}/metrics/tags/`,
      {query: {metric: mri, useCase, project: projects}},
    ],
    {
      enabled: !!mri,
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
  const useCase = getUseCaseFromMRI(mri);
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

export function useMetricsData({
  mri,
  op,
  datetime,
  projects,
  environments,
  query,
  groupBy,
}: MetricsQuery) {
  const organization = useOrganization();

  const useNewMetricsLayer = organization.features.includes(
    'metrics-api-new-metrics-layer'
  );

  const field = op ? `${op}(${mri})` : mri;

  const queryToSend = getMetricsApiRequestQuery(
    {
      field,
      query: `${query}`,
      groupBy,
    },
    {datetime, projects, environments},
    {useNewMetricsLayer}
  );

  return useApiQuery<MetricsApiResponse>(
    [`/organizations/${organization.slug}/metrics/data/`, {query: queryToSend}],
    {
      retry: 0,
      staleTime: 0,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      refetchInterval: data => getRefetchInterval(data, queryToSend.interval),
    }
  );
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
  const [metricsData, setMetricsData] = useState<MetricsApiResponse | undefined>();
  const {data: rawData, isLoading, isError, error} = useMetricsData(props);

  useEffect(() => {
    if (rawData) {
      setMetricsData(rawData);
    }
  }, [rawData]);

  const trimData = (start, end): MetricsApiResponse | undefined => {
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

export function fieldToMri(field: string) {
  const parsedFunction = parseFunction(field);
  if (!parsedFunction) {
    // We only allow aggregate functions for custom metric alerts
    return {
      mri: undefined,
      op: undefined,
    };
  }
  return {
    mri: parsedFunction.arguments[0],
    op: parsedFunction.name,
  };
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
