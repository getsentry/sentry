import {useMemo} from 'react';
import moment from 'moment';

import {getInterval} from 'sentry/components/charts/utils';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {PageFilters} from '../types/core';

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
  datetime: PageFilters['datetime'];
  mri: string;
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
