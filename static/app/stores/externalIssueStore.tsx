import Reflux from 'reflux';

import {PlatformExternalIssue} from 'sentry/types';
import {makeSafeRefluxStore, SafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

type ExternalIssueStoreInterface = {
  add(issue: PlatformExternalIssue): void;
  getInitialState(): PlatformExternalIssue[];
  load(items: PlatformExternalIssue[]): void;
};

const storeConfig: Reflux.StoreDefinition & ExternalIssueStoreInterface = {
  init() {
    this.items = [];
  },

  getInitialState(): PlatformExternalIssue[] {
    return this.items;
  },

  load(items: PlatformExternalIssue[]) {
    this.items = items;
    this.trigger(items);
  },

  get(id: string) {
    return this.items.find((item: PlatformExternalIssue) => item.id === id);
  },

  getAll() {
    return this.items;
  },

  add(issue: PlatformExternalIssue) {
    if (!this.items.some(i => i.id === issue.id)) {
      this.items = this.items.concat([issue]);
      this.trigger(this.items);
    }
  },
};

const ExternalIssueStore = Reflux.createStore(
  makeSafeRefluxStore(storeConfig)
) as SafeRefluxStore & ExternalIssueStoreInterface;

export default ExternalIssueStore;
