import Reflux from 'reflux';

import MetricTagActions from 'sentry/actions/metricTagActions';
import {MetricTag, MetricTagCollection} from 'sentry/types';

type MetricTagStoreInterface = {
  getAllTags(): MetricTagCollection;
  onLoadTagsSuccess(data: MetricTag[]): void;
  reset(): void;
  state: MetricTagCollection;
};

const storeConfig: Reflux.StoreDefinition & MetricTagStoreInterface = {
  state: {},

  init() {
    this.state = {};
    this.listenTo(MetricTagActions.loadMetricsTagsSuccess, this.onLoadTagsSuccess);
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

const MetricTagStore = Reflux.createStore(storeConfig) as Reflux.Store &
  MetricTagStoreInterface;

export default MetricTagStore;
