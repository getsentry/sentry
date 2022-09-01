import {createStore} from 'reflux';

import {SeriesApi} from 'sentry/types';
import {SamplingDistribution, SamplingSdkVersion} from 'sentry/types/sampling';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

type ProjectStats = {
  data: SeriesApi | undefined;
  error: string | undefined;
  loading: boolean;
};

type Distribution = {
  data: SamplingDistribution | undefined;
  error: string | undefined;
  loading: boolean;
};

type SdkVersions = {
  data: SamplingSdkVersion[] | undefined;
  error: string | undefined;
  loading: boolean;
};

type State = {
  distribution: Distribution;
  projectStats30d: ProjectStats;
  projectStats48h: ProjectStats;
  sdkVersions: SdkVersions;
};

const initialState: State = {
  projectStats48h: {
    error: undefined,
    loading: false,
    data: undefined,
  },
  projectStats30d: {
    error: undefined,
    loading: false,
    data: undefined,
  },
  distribution: {
    error: undefined,
    loading: false,
    data: undefined,
  },
  sdkVersions: {
    error: undefined,
    loading: false,
    data: undefined,
  },
};

interface ServerSideSamplingStoreDefinition extends CommonStoreDefinition<State> {
  fetchDistribution(): void;
  fetchDistributionError(error: string): void;
  fetchDistributionSuccess(data: SamplingDistribution): void;

  fetchProjectStats30d(): void;
  fetchProjectStats30dError: (error: string) => void;
  fetchProjectStats30dSuccess: (data: SeriesApi) => void;

  fetchProjectStats48h(): void;
  fetchProjectStats48hError: (error: string) => void;
  fetchProjectStats48hSuccess: (data: SeriesApi) => void;

  fetchSdkVersions(): void;
  fetchSdkVersionsError(error: string): void;
  fetchSdkVersionsSuccess(data: SamplingSdkVersion[]): void;

  reset(): void;
}

const storeConfig: ServerSideSamplingStoreDefinition = {
  state: initialState,

  reset() {
    this.state = initialState;
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },

  fetchProjectStats48h() {
    this.state = {
      ...this.state,
      projectStats48h: {
        error: undefined,
        loading: true,
        data: undefined,
      },
    };
    this.trigger(this.state);
  },

  fetchProjectStats48hSuccess(data: SeriesApi) {
    this.state = {
      ...this.state,
      projectStats48h: {
        error: undefined,
        loading: false,
        data,
      },
    };
    this.trigger(this.state);
  },

  fetchProjectStats48hError(error: string) {
    this.state = {
      ...this.state,
      projectStats48h: {
        error,
        loading: false,
        data: undefined,
      },
    };
    this.trigger(this.state);
  },

  fetchProjectStats30d() {
    this.state = {
      ...this.state,
      projectStats30d: {
        error: undefined,
        loading: true,
        data: undefined,
      },
    };
    this.trigger(this.state);
  },

  fetchProjectStats30dSuccess(data: SeriesApi) {
    this.state = {
      ...this.state,
      projectStats30d: {
        error: undefined,
        loading: false,
        data,
      },
    };
    this.trigger(this.state);
  },

  fetchProjectStats30dError(error: string) {
    this.state = {
      ...this.state,
      projectStats30d: {
        error,
        loading: false,
        data: undefined,
      },
    };
    this.trigger(this.state);
  },

  fetchDistribution() {
    this.state = {
      ...this.state,
      distribution: {
        error: undefined,
        loading: true,
        data: undefined,
      },
    };
    this.trigger(this.state);
  },

  fetchDistributionSuccess(data: SamplingDistribution) {
    this.state = {
      ...this.state,
      distribution: {
        error: undefined,
        loading: false,
        data,
      },
    };
    this.trigger(this.state);
  },

  fetchDistributionError(error: string) {
    this.state = {
      ...this.state,
      distribution: {
        error,
        loading: false,
        data: undefined,
      },
    };
    this.trigger(this.state);
  },

  fetchSdkVersions() {
    this.state = {
      ...this.state,
      sdkVersions: {
        error: undefined,
        loading: true,
        data: undefined,
      },
    };
    this.trigger(this.state);
  },

  fetchSdkVersionsSuccess(data: SamplingSdkVersion[]) {
    this.state = {
      ...this.state,
      sdkVersions: {
        error: undefined,
        loading: false,
        data,
      },
    };
    this.trigger(this.state);
  },

  fetchSdkVersionsError(error: string) {
    this.state = {
      ...this.state,
      sdkVersions: {
        error,
        loading: false,
        data: undefined,
      },
    };
    this.trigger(this.state);
  },
};

export const ServerSideSamplingStore = createStore(makeSafeRefluxStore(storeConfig));
