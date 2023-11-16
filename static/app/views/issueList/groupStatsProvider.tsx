import {createContext, useContext} from 'react';
import {dropUndefinedKeys} from '@sentry/utils';
import * as reactQuery from '@tanstack/react-query';

import {ApiResult} from 'sentry/api';
import type {Group, GroupStats, Organization, PageFilters} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {UseQueryResult} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

function getEndpointParams(
  p: Pick<GroupStatsProviderProps, 'selection' | 'period' | 'query' | 'groupIds'>
): StatEndpointParams {
  const params: StatEndpointParams = {
    project: p.selection.projects,
    environment: p.selection.environments,
    groupStatsPeriod: p.period,
    query: p.query,
    groups: p.groupIds,
    ...p.selection.datetime,
  };

  if (p.selection.datetime.period) {
    delete params.period;
    params.statsPeriod = p.selection.datetime.period;
  }
  if (params.end) {
    params.end = getUtcDateString(params.end);
  }
  if (params.start) {
    params.start = getUtcDateString(params.start);
  }

  return dropUndefinedKeys(params);
}

const GroupStatsContext = createContext<UseQueryResult<
  Record<string, GroupStats>
> | null>(null);

export function useGroupStats(groupId: Group['id']): GroupStats;
export function useGroupStats(): UseQueryResult<Record<string, GroupStats>>;
export function useGroupStats(maybeGroupId?: Group['id']) {
  const ctx = useContext(GroupStatsContext);

  if (!ctx) {
    throw new Error('GroupStatsContext was called ourside of GroupStatsProvider');
  }

  if (typeof maybeGroupId === 'undefined') {
    return ctx;
  }

  return ctx.data?.[maybeGroupId] ?? {};
}

interface StatEndpointParams extends Partial<PageFilters['datetime']> {
  environment: string[];
  groups: Group['id'][];
  project: number[];
  cursor?: string;
  expand?: string | string[];
  groupStatsPeriod?: string | null;
  page?: number | string;
  query?: string | undefined;
  sort?: string;
  statsPeriod?: string | null;
}

interface GroupStatsProviderProps {
  children: React.ReactNode;
  groupIds: Group['id'][];
  organization: Organization;
  period: string;

  selection: PageFilters;
  onRequest?: (promise: Promise<Record<string, GroupStats>>) => void;
  query?: string;
}

export function GroupStatsProvider(props: GroupStatsProviderProps) {
  const api = useApi();

  const queryFn = (): Promise<Record<string, GroupStats>> => {
    const promise = api
      .requestPromise<true>(`/organizations/${props.organization.slug}/issues-stats/`, {
        method: 'GET',
        query: getEndpointParams({
          selection: props.selection,
          period: props.period,
          query: props.query,
          groupIds: props.groupIds,
        }),
        includeAllArgs: true,
      })
      .then((resp: ApiResult<GroupStats[]>): Record<string, GroupStats> => {
        const map: Record<string, GroupStats> = {};
        if (!resp || !Array.isArray(resp[0])) {
          return map;
        }
        for (const stat of resp[0]) {
          map[stat.id] = stat;
        }
        return map;
      });

    if (props.onRequest) {
      props.onRequest(promise);
    }

    return promise;
  };

  const statsQuery = reactQuery.useQuery<Record<string, GroupStats>, RequestError>(
    [`/organizations/${props.organization.slug}/issues-stats/`],
    queryFn,
    {
      enabled: props.groupIds.length > 0,
      staleTime: Infinity,
    }
  );

  return (
    <GroupStatsContext.Provider value={statsQuery}>
      {props.children}
    </GroupStatsContext.Provider>
  );
}
