import {createStore} from 'reflux';

import MetricsMetaActions from 'sentry/actions/metricsMetaActions';
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
  onLoadSuccess(data: MetricsMeta[]): void;
  reset(): void;
}

const storeConfig: MetricsMetaStoreDefinition = {
  unsubscribeListeners: [],
  state: {
    metricsMeta: {},
    loaded: false,
  },

  init() {
    this.unsubscribeListeners.push(
      this.listenTo(MetricsMetaActions.loadMetricsMetaSuccess, this.onLoadSuccess)
    );
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

  onLoadSuccess(data) {
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
