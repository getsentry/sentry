import isEqual from 'lodash/isEqual';
import {createStore} from 'reflux';

import type {Group} from 'sentry/types';

import {CommonStoreDefinition} from './types';

type IssueListCache = {
  groups: Group[];
  pageLinks: string;
  queryCount: number;
  queryMaxCount: number;
};
type IssueListCacheState = {cache: IssueListCache; params: any};

type InternalDefinition = {
  state: IssueListCacheState | null;
};

interface IssueListCacheStoreDefinition
  extends CommonStoreDefinition<IssueListCache | null>,
    InternalDefinition {
  getFromCache(params: any): IssueListCache | null;
  reset(): void;
  save(params: any, data: IssueListCache): void;
}

const storeConfig: IssueListCacheStoreDefinition = {
  state: null,

  init() {},

  reset() {
    this.state = null;
  },

  save(params: any, data: IssueListCache) {
    this.state = {params, cache: data};
    console.log('save', params);
  },

  getFromCache(params: any) {
    if (this.state && isEqual(this.state?.params, params)) {
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
