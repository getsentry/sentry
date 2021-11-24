import Reflux from 'reflux';

import {PlatformExternalIssue} from 'sentry/types';

type ExternalIssueStoreInterface = {
  load(items: PlatformExternalIssue[]): void;
  add(issue: PlatformExternalIssue): void;
  getInitialState(): PlatformExternalIssue[];
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

const ExternalIssueStore = Reflux.createStore(storeConfig) as Reflux.Store &
  ExternalIssueStoreInterface;

export default ExternalIssueStore;
