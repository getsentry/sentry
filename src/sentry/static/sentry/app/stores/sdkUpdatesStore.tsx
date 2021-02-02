import Reflux from 'reflux';

import SdkUpdatesActions from 'app/actions/sdkUpdatesActions';
import {ProjectSdkUpdates} from 'app/types';

type SdkUpdatesStoreInterface = {
  onLoadSuccess(orgSlug: string, data: ProjectSdkUpdates[]): void;
  getUpdates(orgSlug: string): ProjectSdkUpdates[] | undefined;
  isSdkUpdatesLoaded(orgSlug: string): boolean;
};

type Internal = {
  /**
   * Org slug mapping to SDK updates
   */
  orgSdkUpdates: Map<string, ProjectSdkUpdates[]>;
};

const storeConfig: Reflux.StoreDefinition & SdkUpdatesStoreInterface & Internal = {
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

type SdkUpdatesStore = Reflux.Store & SdkUpdatesStoreInterface;

const SdkUpdatesStore = Reflux.createStore(storeConfig) as SdkUpdatesStore;

export default SdkUpdatesStore;
