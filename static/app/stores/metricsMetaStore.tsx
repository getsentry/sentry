import Reflux from 'reflux';

import MetricsMetaActions from 'sentry/actions/metricsMetaActions';
import {MetricsMeta, MetricsMetaCollection} from 'sentry/types';

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

const storeConfig: Reflux.StoreDefinition & Internals & MetricsMetaStoreInterface = {
  metricsMeta: {},

  init() {
    this.listenTo(MetricsMetaActions.loadMetricsMetaSuccess, this.onLoadSuccess);
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

const MetricsMetaStore = Reflux.createStore(storeConfig) as Reflux.Store &
  MetricsMetaStoreInterface;

export default MetricsMetaStore;
