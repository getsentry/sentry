import {createContext, ReactNode, useCallback, useContext} from 'react';

import {ApiResult} from 'sentry/api';
import {Organization} from 'sentry/types';
import {ApiQueryKey} from 'sentry/utils/queryClient';
import useBufferedQuery from 'sentry/utils/replayCount/useBufferedQuery';

interface QueryKeyGenProps {
  dataSource: string;
  fieldName: string;
  organization: Organization;
}

interface Props {
  children: ReactNode;
  queryKeyGenProps: QueryKeyGenProps;
}

type CountValue = undefined | number;
type ExistsValue = undefined | boolean;
type CountState = Record<string, CountValue>;
type ExistsState = Record<string, ExistsValue>;

interface TContext {
  getMany: (ids: readonly string[]) => CountState;
  getOne: (id: string) => CountValue;
  hasMany: (ids: readonly string[]) => ExistsState;
  hasOne: (id: string) => ExistsValue;
}

const DEFAULT_CONTEXT: TContext = {
  getMany: () => ({}),
  getOne: () => undefined,
  hasMany: () => ({}),
  hasOne: () => undefined,
};

const ReplayCacheCountContext = createContext<TContext>(DEFAULT_CONTEXT);

function queryKeyGen({dataSource, fieldName, organization}: QueryKeyGenProps) {
  return (ids: readonly string[]): ApiQueryKey => [
    `/organizations/${organization.slug}/replay-count/`,
    {
      query: {
        data_source: dataSource,
        project: -1,
        statsPeriod: '90d',
        query: `${fieldName}:[${ids.join(',')}]`,
      },
    },
  ];
}

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

function reducer(data: CountState, response: ApiResult) {
  const [newData] = response;
  return {...data, ...newData};
}

/**
 * Base ReactContext for fetching and reducing data from /replay-count/
 *
 * Don't use this directly!
 * Import one of the configured helpers instead:
 *   - `<ReplayExists>` & `useReplayExists()`
 *   - `<ReplayCountForIssues>` & `useReplayCountForIssues()`
 *   - `<ReplayCountForTransactions>` & `useReplayCountForTransactions()`
 *   - `<ReplayCountForFeedbacks>` & `useReplayCountForFeedbacks()`
 *
 * @private
 */
export function ReplayCountCache({children, queryKeyGenProps}: Props) {
  const cache = useBufferedQuery<string, CountState>(
    queryKeyGen(queryKeyGenProps),
    reducer,
    {}
  );

  const getMany = useCallback(
    (ids: readonly string[]) => {
      cache.buffer(ids);
      return filterKeysInList(cache.data, ids);
    },
    [cache]
  );

  const getOne = useCallback(
    (id: string) => {
      cache.buffer([id]);
      return cache.data[id];
    },
    [cache]
  );

  const hasMany = useCallback(
    (ids: readonly string[]) => mapToBool(getMany(ids)),
    [getMany]
  );

  const hasOne = useCallback((id: string) => boolIfDefined(getOne(id)), [getOne]);

  return (
    <ReplayCacheCountContext.Provider value={{getOne, getMany, hasOne, hasMany}}>
      {children}
    </ReplayCacheCountContext.Provider>
  );
}

/**
 * Base ReactContext for fetching and reducing data from /replay-count/
 *
 * Don't use this directly!
 * Import one of the configured helpers instead:
 *   - `<ReplayExists>` & `useReplayExists()`
 *   - `<ReplayCountForIssues>` & `useReplayCountForIssues()`
 *   - `<ReplayCountForTransactions>` & `useReplayCountForTransactions()`
 *   - `<ReplayCountForFeedbacks>` & `useReplayCountForFeedbacks()`
 *
 * @private
 */
export function useReplayCount() {
  return useContext(ReplayCacheCountContext);
}
