import {Store} from '@tanstack/react-store';
import isEqual from 'lodash/isEqual';

import type {Group} from 'sentry/types/group';

/**
 * The type here doesn't really matter it just needs to be compared via isEqual
 */
type LooseParamsType = Record<string, any>;

interface IssueListCache {
  groups: Group[];
  pageLinks: string;
  queryCount: number;
  queryMaxCount: number;
}

interface IssueListCacheState {
  /**
   * The data that was cached
   */
  cache: IssueListCache;
  /**
   * Do not use this directly, use `getFromCache` instead
   */
  expiration: number;
  /**
   * The params that were used to generate the cache
   * eg - {query: 'Some query'}
   */
  params: LooseParamsType;
}

// 30 seconds
const CACHE_EXPIRATION = 30 * 1000;

const store = new Store<IssueListCacheState | null>(null);

export const IssueListCacheStore = {
  store,

  getState() {
    return store.state;
  },

  reset() {
    store.setState(() => null);
  },

  save(params: LooseParamsType, data: IssueListCache) {
    store.setState(() => ({
      params,
      cache: data,
      expiration: Date.now() + CACHE_EXPIRATION,
    }));
  },

  getFromCache(params: LooseParamsType) {
    const state = store.state;
    if (state && state.expiration > Date.now() && isEqual(state.params, params)) {
      return state.cache;
    }

    return null;
  },

  markGroupAsSeen(groupId: string) {
    const matchingGroup = store.state?.cache.groups.find(group => group.id === groupId);
    if (matchingGroup) {
      matchingGroup.hasSeen = true;
    }
  },
};
