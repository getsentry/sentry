import isEqual from 'lodash/isEqual';
import {createStore} from 'zustand/vanilla';

import type {Group} from 'sentry/types/group';

/**
 * The issue list request params, only ever compared with `isEqual`
 */
type IssueListCacheParams = Readonly<Record<string, unknown>>;

interface IssueListCache {
  readonly groups: Group[];
  readonly pageLinks: string;
  readonly queryCount: number;
  readonly queryMaxCount: number;
}

interface IssueListCacheEntry {
  /**
   * The data that was cached
   */
  readonly cache: IssueListCache;
  /**
   * When the entry stops being served, in milliseconds since epoch
   */
  readonly expiration: number;
  /**
   * The params that were used to generate the cache
   * eg - {query: 'Some query'}
   */
  readonly params: IssueListCacheParams;
}

interface IssueListCacheState {
  readonly entry: IssueListCacheEntry | null;
}

// 30 seconds
const CACHE_EXPIRATION = 30 * 1000;

const store = createStore<IssueListCacheState>()(() => ({entry: null}));

export const IssueListCacheStore = {
  reset(): void {
    store.setState({entry: null});
  },

  save(params: IssueListCacheParams, data: IssueListCache): void {
    store.setState({
      entry: {
        params,
        cache: data,
        expiration: Date.now() + CACHE_EXPIRATION,
      },
    });
  },

  getFromCache(params: IssueListCacheParams): IssueListCache | null {
    const {entry} = store.getState();
    if (entry && entry.expiration > Date.now() && isEqual(entry.params, params)) {
      return entry.cache;
    }

    return null;
  },

  markGroupAsSeen(groupId: string): void {
    const matchingGroup = store
      .getState()
      .entry?.cache.groups.find(group => group.id === groupId);
    if (matchingGroup) {
      matchingGroup.hasSeen = true;
    }
  },
};
