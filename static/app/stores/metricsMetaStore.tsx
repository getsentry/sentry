import {createStore, StoreDefinition} from 'reflux';

import MetricsMetaActions from 'sentry/actions/metricsMetaActions';
import {MetricsMeta, MetricsMetaCollection} from 'sentry/types';
import {
  makeSafeRefluxStore,
  SafeRefluxStore,
  SafeStoreDefinition,
} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreInterface} from './types';

type State = {
  metricsMeta: MetricsMetaCollection;
};

type Internals = {
  metricsMeta: MetricsMetaCollection;
};

type MetricsMetaStoreInterface = CommonStoreInterface<State> & {
  onLoadSuccess(data: MetricsMeta[]): void;
  reset(): void;
};

const storeConfig: StoreDefinition &
  Internals &
  MetricsMetaStoreInterface &
  SafeStoreDefinition = {
  unsubscribeListeners: [],
  metricsMeta: {},

  init() {
    this.unsubscribeListeners.push(
      this.listenTo(MetricsMetaActions.loadMetricsMetaSuccess, this.onLoadSuccess)
    );
  },

  reset() {
    this.metricsMeta = {};
    this.trigger(this.metricsMeta);
  },

  getState() {
    const {metricsMeta} = this;
    return {metricsMeta};
  },

  onLoadSuccess(data) {
    const newFields = data.reduce<MetricsMetaCollection>((acc, field) => {
      acc[field.name] = {
        ...field,
      };

      return acc;
    }, {});

    this.metricsMeta = {...this.metricsMeta, ...newFields};
    this.trigger(this.metricsMeta);
  },
};

const MetricsMetaStore = createStore(
  makeSafeRefluxStore(storeConfig)
) as SafeRefluxStore & MetricsMetaStoreInterface;

export default MetricsMetaStore;
