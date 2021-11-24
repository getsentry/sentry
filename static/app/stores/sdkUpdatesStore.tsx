import Reflux from 'reflux';

import SdkUpdatesActions from 'sentry/actions/sdkUpdatesActions';
import {ProjectSdkUpdates} from 'sentry/types';

type SdkUpdatesStoreInterface = {
  onLoadSuccess(orgSlug: string, data: ProjectSdkUpdates[]): void;
  getUpdates(orgSlug: string): ProjectSdkUpdates[] | undefined;
  isSdkUpdatesLoaded(orgSlug: string): boolean;
};

type Internals = {
  /**
   * Org slug mapping to SDK updates
   */
  orgSdkUpdates: Map<string, ProjectSdkUpdates[]>;
};

const storeConfig: Reflux.StoreDefinition & Internals & SdkUpdatesStoreInterface = {
  orgSdkUpdates: new Map(),

  init() {
    this.listenTo(SdkUpdatesActions.load, this.onLoadSuccess);
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

const SdkUpdatesStore = Reflux.createStore(storeConfig) as Reflux.Store &
  SdkUpdatesStoreInterface;

export default SdkUpdatesStore;
