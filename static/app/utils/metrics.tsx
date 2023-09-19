import {useMemo} from 'react';
import moment from 'moment';

import {getInterval} from 'sentry/components/charts/utils';
import {parseStatsPeriod} from 'sentry/components/organizations/timeRangeSelector/utils';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type MetricMeta = {
  mri: string;
  operations: string[];
};

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
  mri: string;
  timeRange: any;
  groupBy?: string[];
  op?: string;
  projects?: string[];
  queryString?: string;
};

type Group = {
  by: Record<string, unknown>;
  series: Record<string, number[]>;
  totals: Record<string, number>;
};

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
  timeRange,
  projects,
  queryString,
  groupBy,
}: MetricsDataProps) {
  const {slug} = useOrganization();
  const useCase = getUseCaseFromMri(mri);
  const field = op ? `${op}(${mri})` : mri;

  const {start, end} = getUTCTimeRange(timeRange);
  const interval = getInterval({start, end}, 'metrics');

  const query = getQueryString({projects, queryString});

  const queryToSend = {
    field,
    useCase,
    interval,
    query,
    groupBy,
    start,
    end,
    // max result groups
    per_page: 20,
  };

  return useApiQuery<MetricsData>(
    [`/organizations/${slug}/metrics/data/`, {query: queryToSend}],
    {
      staleTime: 60,
      retry: 0,
    }
  );
}

function getQueryString({
  projects = [],
  queryString = '',
}: Pick<MetricsDataProps, 'projects' | 'queryString'>): string {
  const projectQuery = projects.map(p => `project:${p}`).join(' OR ');
  return [projectQuery, queryString].join(' ');
}

const getUTCTimeRange = (timeRange: Record<string, any>) => {
  const absoluteTimeRange = timeRange.relative
    ? parseStatsPeriod(timeRange.relative)
    : timeRange;

  return {
    start: moment(absoluteTimeRange.start).utc().toISOString(),
    end: moment(absoluteTimeRange.end).utc().toISOString(),
  };
};

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
