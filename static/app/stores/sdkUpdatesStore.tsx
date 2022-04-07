import {createStore, StoreDefinition} from 'reflux';

import {ProjectSdkUpdates} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

type InternalDefinition = {
  /**
   * Org slug mapping to SDK updates
   */
  orgSdkUpdates: Map<string, ProjectSdkUpdates[]>;
};

interface SdkUpdatesStoreDefinition extends StoreDefinition, InternalDefinition {
  getUpdates(orgSlug: string): ProjectSdkUpdates[] | undefined;
  isSdkUpdatesLoaded(orgSlug: string): boolean;
  loadSuccess(orgSlug: string, data: ProjectSdkUpdates[]): void;
}

const storeConfig: SdkUpdatesStoreDefinition = {
  orgSdkUpdates: new Map(),
  unsubscribeListeners: [],

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
};

const SdkUpdatesStore = createStore(makeSafeRefluxStore(storeConfig));
export default SdkUpdatesStore;
