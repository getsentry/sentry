import {createStore, StoreDefinition} from 'reflux';

import SdkUpdatesActions from 'sentry/actions/sdkUpdatesActions';
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
  onLoadSuccess(orgSlug: string, data: ProjectSdkUpdates[]): void;
}

const storeConfig: SdkUpdatesStoreDefinition = {
  orgSdkUpdates: new Map(),
  unsubscribeListeners: [],

  init() {
    this.unsubscribeListeners.push(
      this.listenTo(SdkUpdatesActions.load, this.onLoadSuccess)
    );
  },

  onLoadSuccess(orgSlug, data) {
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
