import {createStore} from 'reflux';

import {SeriesApi} from 'sentry/types';
import {SamplingDistribution, SamplingSdkVersion} from 'sentry/types/sampling';

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
  distributionRequestError(error: string): void;
  distributionRequestLoading(): void;
  distributionRequestSuccess(data: SamplingDistribution): void;

  projectStats30dRequestError: (error: string) => void;
  projectStats30dRequestLoading(): void;
  projectStats30dRequestSuccess: (data: SeriesApi) => void;

  projectStats48hRequestError: (error: string) => void;
  projectStats48hRequestLoading(): void;
  projectStats48hRequestSuccess: (data: SeriesApi) => void;

  reset(): void;

  sdkVersionsRequestError(error: string): void;
  sdkVersionsRequestLoading(): void;
  sdkVersionsRequestSuccess(data: SamplingSdkVersion[]): void;
}

const storeConfig: ServerSideSamplingStoreDefinition = {
  state: initialState,

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.
  },

  reset() {
    this.state = initialState;
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },

  projectStats48hRequestLoading() {
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

  projectStats48hRequestSuccess(data: SeriesApi) {
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

  projectStats48hRequestError(error: string) {
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

  projectStats30dRequestLoading() {
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

  projectStats30dRequestSuccess(data: SeriesApi) {
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

  projectStats30dRequestError(error: string) {
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

  distributionRequestLoading() {
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

  distributionRequestSuccess(data: SamplingDistribution) {
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

  distributionRequestError(error: string) {
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

  sdkVersionsRequestLoading() {
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

  sdkVersionsRequestSuccess(data: SamplingSdkVersion[]) {
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

  sdkVersionsRequestError(error: string) {
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

export const ServerSideSamplingStore = createStore(storeConfig);
