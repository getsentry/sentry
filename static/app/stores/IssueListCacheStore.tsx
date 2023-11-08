import isEqual from 'lodash/isEqual';
import {createStore} from 'reflux';

import type {Group} from 'sentry/types';

import {CommonStoreDefinition} from './types';

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

interface InternalDefinition {
  state: IssueListCacheState | null;
}

// 30 seconds
const CACHE_EXPIRATION = 30 * 1000;

interface IssueListCacheStoreDefinition
  extends CommonStoreDefinition<IssueListCache | null>,
    InternalDefinition {
  getFromCache(params: LooseParamsType): IssueListCache | null;
  reset(): void;
  save(params: LooseParamsType, data: IssueListCache): void;
}

const storeConfig: IssueListCacheStoreDefinition = {
  state: null,

  init() {},

  reset() {
    this.state = null;
  },

  save(params: LooseParamsType, data: IssueListCache) {
    this.state = {
      params,
      cache: data,
      expiration: Date.now() + CACHE_EXPIRATION,
    };
  },

  getFromCache(params: LooseParamsType) {
    if (
      this.state &&
      this.state.expiration > Date.now() &&
      isEqual(this.state?.params, params)
    ) {
      return this.state.cache;
    }

    return null;
  },

  getState() {
    return this.state?.cache ?? null;
  },
};

const IssueListCacheStore = createStore(storeConfig);
export default IssueListCacheStore;
