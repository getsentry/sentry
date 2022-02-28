import Reflux from 'reflux';

import MetricsMetaActions from 'sentry/actions/metricsMetaActions';
import {MetricMeta, MetricsMetaCollection} from 'sentry/types';

type MetricsMetaStoreInterface = {
  getAllFields(): MetricsMetaCollection;
  onLoadSuccess(data: MetricMeta[]): void;
  reset(): void;
  state: MetricsMetaCollection;
};

const storeConfig: Reflux.StoreDefinition & MetricsMetaStoreInterface = {
  state: {},

  init() {
    this.state = {};
    this.listenTo(MetricsMetaActions.loadMetricsMetaSuccess, this.onLoadSuccess);
  },

  reset() {
    this.state = {};
    this.trigger(this.state);
  },

  getAllFields() {
    return this.state;
  },

  onLoadSuccess(data) {
    const newFields = data.reduce<MetricsMetaCollection>((acc, field) => {
      acc[field.name] = {
        ...field,
      };

      return acc;
    }, {});

    this.state = {...this.state, ...newFields};
    this.trigger(this.state);
  },
};

const MetricsMetaStore = Reflux.createStore(storeConfig) as Reflux.Store &
  MetricsMetaStoreInterface;

export default MetricsMetaStore;
