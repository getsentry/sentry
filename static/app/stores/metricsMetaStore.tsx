import {createStore} from 'reflux';

import MetricsMetaActions from 'sentry/actions/metricsMetaActions';
import {MetricsMeta, MetricsMetaCollection} from 'sentry/types';
import {makeSafeRefluxStore, SafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

type State = {
  metricsMeta: MetricsMetaCollection;
};

type InternalDefinition = {
  metricsMeta: MetricsMetaCollection;
};

interface MetricsMetaStoreDefinition
  extends InternalDefinition,
    CommonStoreDefinition<State> {
  onLoadSuccess(data: MetricsMeta[]): void;
  reset(): void;
}

const storeConfig: MetricsMetaStoreDefinition = {
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
) as SafeRefluxStore & MetricsMetaStoreDefinition;

export default MetricsMetaStore;
