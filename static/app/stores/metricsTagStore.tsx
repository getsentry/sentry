import Reflux from 'reflux';

import MetricsTagActions from 'sentry/actions/metricTagActions';
import {MetricTag, MetricTagCollection} from 'sentry/types';

type MetricsTagStoreInterface = {
  getAllTags(): MetricTagCollection;
  onLoadTagsSuccess(data: MetricTag[]): void;
  reset(): void;
  state: MetricTagCollection;
};

const storeConfig: Reflux.StoreDefinition & MetricsTagStoreInterface = {
  state: {},

  init() {
    this.state = {};
    this.listenTo(MetricsTagActions.loadMetricsTagsSuccess, this.onLoadTagsSuccess);
  },

  reset() {
    this.state = {};
    this.trigger(this.state);
  },

  getAllTags() {
    return this.state;
  },

  onLoadTagsSuccess(data) {
    const newTags = data.reduce<MetricTagCollection>((acc, tag) => {
      acc[tag.key] = {
        ...tag,
      };

      return acc;
    }, {});

    this.state = {...this.state, ...newTags};
    this.trigger(this.state);
  },
};

const MetricsTagStore = Reflux.createStore(storeConfig) as Reflux.Store &
  MetricsTagStoreInterface;

export default MetricsTagStore;
