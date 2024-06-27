import {createStore} from 'reflux';

import type {ProjectSdkUpdates} from 'sentry/types/project';

import type {StrictStoreDefinition} from './types';

/**
 * Org slug mapping to SDK updates
 */
type State = Map<string, ProjectSdkUpdates[]>;

interface SdkUpdatesStoreDefinition extends StrictStoreDefinition<State> {
  getUpdates(orgSlug: string): ProjectSdkUpdates[] | undefined;
  isSdkUpdatesLoaded(orgSlug: string): boolean;
  loadSuccess(orgSlug: string, data: ProjectSdkUpdates[]): void;
}

const storeConfig: SdkUpdatesStoreDefinition = {
  state: new Map(),

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.
  },

  loadSuccess(orgSlug, data) {
    this.state.set(orgSlug, data);
    this.trigger(this.state);
  },

  getUpdates(orgSlug) {
    return this.state.get(orgSlug);
  },

  isSdkUpdatesLoaded(orgSlug) {
    return this.state.has(orgSlug);
  },

  getState() {
    return this.state;
  },
};

const SdkUpdatesStore = createStore(storeConfig);
export default SdkUpdatesStore;
