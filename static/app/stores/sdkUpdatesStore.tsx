import Reflux from 'reflux';

import SdkUpdatesActions from 'sentry/actions/sdkUpdatesActions';
import {ProjectSdkUpdates} from 'sentry/types';
import {makeSafeRefluxStore, SafeStoreDefinition} from 'sentry/utils/makeSafeRefluxStore';

type SdkUpdatesStoreInterface = {
  getUpdates(orgSlug: string): ProjectSdkUpdates[] | undefined;
  isSdkUpdatesLoaded(orgSlug: string): boolean;
  onLoadSuccess(orgSlug: string, data: ProjectSdkUpdates[]): void;
};

type Internals = {
  /**
   * Org slug mapping to SDK updates
   */
  orgSdkUpdates: Map<string, ProjectSdkUpdates[]>;
};

const storeConfig: Reflux.StoreDefinition &
  Internals &
  SdkUpdatesStoreInterface &
  SafeStoreDefinition = {
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

const SdkUpdatesStore = Reflux.createStore(
  makeSafeRefluxStore(storeConfig)
) as Reflux.Store & SdkUpdatesStoreInterface;

export default SdkUpdatesStore;
