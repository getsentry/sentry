import {useCallback} from 'react';

import {ApiResult} from 'sentry/api';
import {Organization} from 'sentry/types';
import useAggregatedQueryKeys from 'sentry/utils/api/useAggregatedQueryKeys';
import {ApiQueryKey} from 'sentry/utils/queryClient';

interface Props {
  bufferLimit: number;
  dataSource: string;
  fieldName: string;
  organization: Organization;
  statsPeriod: string;
}

type CountValue = undefined | number;
type CountState = Record<string, CountValue>;

function filterKeysInList<V>(obj: Record<string, V>, list: readonly string[]) {
  return Object.fromEntries(Object.entries(obj).filter(([key, _value]) => key in list));
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
 *   - `useReplayCountForTransactions()`
 *   - `useReplayCountForFeedbacks()`
 *
 * @private
 */
export default function useReplayCount({
  bufferLimit,
  dataSource,
  fieldName,
  organization,
  statsPeriod,
}: Props) {
  const cache = useAggregatedQueryKeys<string, CountState>({
    bufferLimit,
    getQueryKey: useCallback(
      (ids: readonly string[]): ApiQueryKey => [
        `/organizations/${organization.slug}/replay-count/`,
        {
          query: {
            data_source: dataSource,
            project: -1,
            statsPeriod,
            query: `${fieldName}:[${ids.join(',')}]`,
          },
        },
      ],
      [dataSource, fieldName, organization, statsPeriod]
    ),
    responseReducer: useCallback(
      (data: undefined | CountState, response: ApiResult) => ({...data, ...response[0]}),
      []
    ),
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
