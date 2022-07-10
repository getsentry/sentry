import {createStore} from 'reflux';

import {SamplingDistribution, SamplingSdkVersion} from 'sentry/types/sampling';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

type State = {
  samplingDistribution: SamplingDistribution;
  samplingSdkVersions: SamplingSdkVersion[];
};

interface ServerSideSamplingStoreDefinition extends CommonStoreDefinition<State> {
  loadSamplingDistributionSuccess(data: SamplingDistribution): void;
  loadSamplingSdkVersionsSuccess(data: SamplingSdkVersion[]): void;
  reset(): void;
}

const storeConfig: ServerSideSamplingStoreDefinition = {
  state: {
    samplingDistribution: {},
    samplingSdkVersions: [],
  },

  reset() {
    this.state = {
      samplingDistribution: {},
      samplingSdkVersions: [],
    };
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },

  loadSamplingSdkVersionsSuccess(data: SamplingSdkVersion[]) {
    this.state = {
      ...this.state,
      samplingSdkVersions: data,
    };
    this.trigger(this.state);
  },

  loadSamplingDistributionSuccess(data: SamplingDistribution) {
    this.state = {
      ...this.state,
      samplingDistribution: data,
    };
    this.trigger(this.state);
  },
};

export const ServerSideSamplingStore = createStore(makeSafeRefluxStore(storeConfig));
