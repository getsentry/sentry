import {useCallback} from 'react';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useAggregatedQueryKeys} from 'sentry/utils/api/useAggregatedQueryKeys';

interface Props {
  bufferLimit: number;
  dataSource: 'events' | 'transactions' | 'search_issues';
  fieldName: string;
  organization: Organization;
  statsPeriod: string;
  end?: string;
  start?: string;
}

type CountValue = undefined | number;
type CountState = Record<string, CountValue>;

function filterKeysInList<V>(obj: Record<string, V>, list: readonly string[]) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key, _value]) => list.includes(key))
  );
}

function boolIfDefined(val: undefined | unknown) {
  return val === undefined ? undefined : Boolean(val);
}

function mapToBool<V>(obj: Record<string, V>): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, Boolean(value)])
  );
}

/**
 * Base hook for fetching and reducing data from /replay-count/
 *
 * Don't use this directly!
 * Import one of the configured helpers instead:
 *   - `useReplayExists()`
 *   - `useReplayCountForIssues()`
 *   - `useReplayCountForFeedbacks()`
 *
 * @private
 */
export function useReplayCount({
  bufferLimit,
  dataSource,
  fieldName,
  organization,
  statsPeriod,
  start,
  end,
}: Props) {
  const _statsPeriod = start && end ? undefined : statsPeriod;
  const cachePeriod = start && end ? `${start}-${end}` : statsPeriod;

  const cache = useAggregatedQueryKeys<string, CountState>({
    cacheKey: `/organizations/${organization.slug}/replay-count/|${dataSource}|${fieldName}|${cachePeriod}`,
    bufferLimit,
    getQueryOptions: useCallback(
      ids =>
        apiOptions.as<CountState>()(
          '/organizations/$organizationIdOrSlug/replay-count/',
          {
            path: {organizationIdOrSlug: organization.slug},
            query: {
              data_source: dataSource,
              project: -1,
              statsPeriod: _statsPeriod,
              start,
              end,
              query:
                fieldName === 'transaction'
                  ? `${fieldName}:[${ids.map(id => `"${id}"`).join(',')}]`
                  : `${fieldName}:[${ids.join(',')}]`,
            },
            staleTime: 0,
          }
        ),
      [dataSource, fieldName, organization.slug, _statsPeriod, start, end]
    ),
    responseReducer: useCallback((prevState, response, aggregates) => {
      const defaults = Object.fromEntries(aggregates.map(id => [id, 0]));
      return {...defaults, ...prevState, ...response.json};
    }, []),
  });

  const getMany = useCallback(
    (ids: readonly string[]) => {
      cache.buffer(ids);
      return filterKeysInList(cache.data ?? {}, ids);
    },
    [cache]
  );

  const getOne = useCallback(
    (id: string) => {
      cache.buffer([id]);

      return cache.data?.[id];
    },
    [cache]
  );

  const hasMany = useCallback(
    (ids: readonly string[]) => mapToBool(getMany(ids)),
    [getMany]
  );

  const hasOne = useCallback((id: string) => boolIfDefined(getOne(id)), [getOne]);

  return {getOne, getMany, hasOne, hasMany};
}
