import {createStore} from 'reflux';

import {ProjectSdkUpdates} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

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

  getState() {
    return this.orgSdkUpdates;
  },
};

const SdkUpdatesStore = createStore(makeSafeRefluxStore(storeConfig));
export default SdkUpdatesStore;
