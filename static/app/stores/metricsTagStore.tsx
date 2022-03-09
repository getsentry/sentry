import Reflux from 'reflux';

import MetricsTagActions from 'sentry/actions/metricTagActions';
import {MetricsTag, MetricsTagCollection} from 'sentry/types';

import {CommonStoreInterface} from './types';

type State = {
  metricsTags: MetricsTagCollection;
};

type Internals = {
  metricsTags: MetricsTagCollection;
};

type MetricsTagStoreInterface = CommonStoreInterface<State> & {
  onLoadSuccess(data: MetricsTag[]): void;
  reset(): void;
};

const storeConfig: Reflux.StoreDefinition & Internals & MetricsTagStoreInterface = {
  metricsTags: {},

  init() {
    this.listenTo(MetricsTagActions.loadMetricsTagsSuccess, this.onLoadSuccess);
  },

  reset() {
    this.metricsTags = {};
    this.trigger(this.metricsTags);
  },

  getState() {
    const {metricsTags} = this;
    return {metricsTags};
  },

  onLoadSuccess(data) {
    const newTags = data.reduce<MetricsTagCollection>((acc, tag) => {
      acc[tag.key] = {
        ...tag,
      };

      return acc;
    }, {});

    this.metricsTags = {...this.metricsTags, ...newTags};
    this.trigger(this.metricsTags);
  },
};

const MetricsTagStore = Reflux.createStore(storeConfig) as Reflux.Store &
  MetricsTagStoreInterface;

export default MetricsTagStore;
