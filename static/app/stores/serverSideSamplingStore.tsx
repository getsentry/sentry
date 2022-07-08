import {createStore} from 'reflux';

import {SamplingSdkVersion} from 'sentry/types/sampling';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

type State = {
  loaded: boolean;
  samplingSdkVersions: SamplingSdkVersion[];
};

interface ServerSideSamplingStoreDefinition extends CommonStoreDefinition<State> {
  loadSuccess(data: SamplingSdkVersion[]): void;
  reset(): void;
}

const storeConfig: ServerSideSamplingStoreDefinition = {
  state: {
    samplingSdkVersions: [],
    loaded: false,
  },

  reset() {
    this.state = {samplingSdkVersions: [], loaded: false};
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },

  loadSuccess(samplingSdkVersions) {
    this.state = {samplingSdkVersions, loaded: true};
    this.trigger(this.state);
  },
};

export const ServerSideSamplingStore = createStore(makeSafeRefluxStore(storeConfig));
