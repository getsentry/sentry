import {createStore} from 'reflux';

import {CommonStoreDefinition} from 'sentry/stores/types';
import {PlatformExternalIssue} from 'sentry/types';

interface ExternalIssueStoreDefinition
  extends CommonStoreDefinition<PlatformExternalIssue[]> {
  add(issue: PlatformExternalIssue): void;
  getInitialState(): PlatformExternalIssue[];
  load(items: PlatformExternalIssue[]): void;
}

const storeConfig: ExternalIssueStoreDefinition = {
  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.items = [];
  },

  getState() {
    return this.items;
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

const ExternalIssueStore = createStore(storeConfig);
export default ExternalIssueStore;
