import {createContext, useContext, useEffect, useRef} from 'react';
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

export function useGroupStats(group: Group): GroupStats {
  const ctx = useContext(GroupStatsContext);

  if (!ctx) {
    return group;
  }

  return ctx.data?.[group.id] ?? group;
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

export type GroupStatsQuery = UseQueryResult<Record<string, GroupStats>, RequestError>;

export interface GroupStatsProviderProps {
  children: React.ReactNode;
  groupIds: Group['id'][];
  organization: Organization;
  period: string;

  selection: PageFilters;
  onStatsQuery?: (query: GroupStatsQuery) => void;
  query?: string;
}

class CacheNode<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}
class Cache<T> {
  private map: Map<string, CacheNode<T>>;

  constructor() {
    this.map = new Map();
  }

  get(key: string): T | undefined {
    return this.map.get(key)?.value;
  }
  set(key: string, value: T): T {
    const node = new CacheNode(value);
    this.map.set(key, node);
    return node.value;
  }
}

export function GroupStatsProvider(props: GroupStatsProviderProps) {
  const api = useApi();
  const cache = useRef<Cache<Record<string, GroupStats>> | null>(null);

  if (!cache.current) {
    cache.current = new Cache<Record<string, GroupStats>>();
  }

  const queryFn = (): Promise<Record<string, GroupStats>> => {
    const query = getEndpointParams({
      selection: props.selection,
      period: props.period,
      query: props.query,
      groupIds: props.groupIds,
    });

    const {groups: _groups, ...rest} = query;
    const cacheKey = JSON.stringify({...rest, organization: props.organization.slug});

    const entry = cache.current && cache.current.get(cacheKey);
    if (entry) {
      query.groups = query.groups.filter(id => !entry[id]);
    }

    // Dont make a request if there are no groups to fetch data from
    // and we have a cached entry that we can resolve with
    if (!query.groups.length && entry) {
      return Promise.resolve(entry);
    }

    // Dont make a request if there are no groups
    if (!query.groups.length) {
      return Promise.resolve({});
    }

    const promise = api
      .requestPromise<true>(`/organizations/${props.organization.slug}/issues-stats/`, {
        method: 'GET',
        query,
        includeAllArgs: true,
      })
      .then((resp: ApiResult<GroupStats[]>): Record<string, GroupStats> => {
        const map = cache.current?.get(cacheKey) ?? {};

        if (!map) {
          return {};
        }
        if (!resp || !Array.isArray(resp[0])) {
          return {...map};
        }

        for (const stat of resp[0]) {
          map[stat.id] = stat;
        }

        if (cache.current) {
          cache.current.set(cacheKey, map);
        }

        // Return a copy so that callers cannot mutate the cache
        return {...map};
      })
      .catch(() => {
        return {};
      });

    return promise;
  };

  const statsQuery = reactQuery.useQuery<Record<string, GroupStats>, RequestError>(
    [
      `/organizations/${props.organization.slug}/issues-stats/`,
      props.selection,
      props.period,
      props.query,
      props.groupIds,
    ],
    queryFn,
    {
      enabled: props.groupIds.length > 0,
      staleTime: Infinity,
    }
  );

  const onStatsQuery = props.onStatsQuery;
  useEffect(() => {
    onStatsQuery?.(statsQuery);
    // We only want to fire the observer when the status changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsQuery.status, onStatsQuery]);

  return (
    <GroupStatsContext.Provider value={statsQuery}>
      {props.children}
    </GroupStatsContext.Provider>
  );
}
