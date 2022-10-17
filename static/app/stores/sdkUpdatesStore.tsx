import {createStore} from 'reflux';

import {ProjectSdkUpdates} from 'sentry/types';

import {CommonStoreDefinition} from './types';

/**
 * Org slug mapping to SDK updates
 */
type State = Map<string, ProjectSdkUpdates[]>;

type InternalDefinition = {
  orgSdkUpdates: State;
};

interface SdkUpdatesStoreDefinition
  extends CommonStoreDefinition<State>,
    InternalDefinition {
  getUpdates(orgSlug: string): ProjectSdkUpdates[] | undefined;
  isSdkUpdatesLoaded(orgSlug: string): boolean;
  loadSuccess(orgSlug: string, data: ProjectSdkUpdates[]): void;
}

const storeConfig: SdkUpdatesStoreDefinition = {
  orgSdkUpdates: new Map(),

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.
  },

  loadSuccess(orgSlug, data) {
    this.orgSdkUpdates.set(orgSlug, data);
    this.trigger(this.orgSdkUpdates);
  },

  getUpdates(orgSlug) {
    return this.orgSdkUpdates.get(orgSlug);
  },

  isSdkUpdatesLoaded(orgSlug) {
    return this.orgSdkUpdates.has(orgSlug);
  },

  getState() {
    return this.orgSdkUpdates;
  },
};

const SdkUpdatesStore = createStore(storeConfig);
export default SdkUpdatesStore;
