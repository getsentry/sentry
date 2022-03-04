import Reflux from 'reflux';

import MetricsTagActions from 'sentry/actions/metricTagActions';
import {MetricsTag, MetricsTagCollection} from 'sentry/types';

type MetricsTagStoreInterface = {
  getAllTags(): MetricsTagCollection;
  onLoadTagsSuccess(data: MetricsTag[]): void;
  reset(): void;
  state: MetricsTagCollection;
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
    const newTags = data.reduce<MetricsTagCollection>((acc, tag) => {
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
