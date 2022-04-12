import {createStore} from 'reflux';

import {MetricsMeta, MetricsMetaCollection} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

type State = {
  /**
   * This is state for when tags fetched from the API are loaded
   */
  loaded: boolean;
  metricsMeta: MetricsMetaCollection;
};

interface MetricsMetaStoreDefinition extends CommonStoreDefinition<State> {
  loadSuccess(data: MetricsMeta[]): void;
  reset(): void;
}

const storeConfig: MetricsMetaStoreDefinition = {
  unsubscribeListeners: [],
  state: {
    metricsMeta: {},
    loaded: false,
  },

  reset() {
    this.state = {
      metricsMeta: {},
      loaded: false,
    };
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },

  loadSuccess(data) {
    const newFields = data.reduce<MetricsMetaCollection>((acc, field) => {
      acc[field.name] = {
        ...field,
      };

      return acc;
    }, {});

    this.state = {
      metricsMeta: {...this.state.metricsMeta, ...newFields},
      loaded: true,
    };
    this.trigger(this.state);
  },
};

const MetricsMetaStore = createStore(makeSafeRefluxStore(storeConfig));

export default MetricsMetaStore;
