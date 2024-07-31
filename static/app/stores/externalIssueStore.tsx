import {createStore} from 'reflux';

import type {StrictStoreDefinition} from 'sentry/stores/types';
import type {PlatformExternalIssue} from 'sentry/types/integrations';

interface ExternalIssueStoreDefinition
  extends StrictStoreDefinition<PlatformExternalIssue[]> {
  add(issue: PlatformExternalIssue): void;
  load(items: PlatformExternalIssue[]): void;
}

const storeConfig: ExternalIssueStoreDefinition = {
  state: [],
  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.state = [];
  },

  getState() {
    return this.state;
  },

  load(items: PlatformExternalIssue[]) {
    this.state = items;
    this.trigger(items);
  },

  add(issue: PlatformExternalIssue) {
    if (!this.state.some(i => i.id === issue.id)) {
      this.state = this.state.concat([issue]);
      this.trigger(this.state);
    }
  },
};

const ExternalIssueStore = createStore(storeConfig);
export default ExternalIssueStore;
