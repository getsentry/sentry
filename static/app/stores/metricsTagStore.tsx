import {createStore, Store} from 'reflux';

import MetricsTagActions from 'sentry/actions/metricTagActions';
import {MetricsTag, MetricsTagCollection} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

type State = {
  metricsTags: MetricsTagCollection;
};

type InternalDefinition = {
  metricsTags: MetricsTagCollection;
};

interface MetricsTagStoreDefinition
  extends InternalDefinition,
    CommonStoreDefinition<State> {
  onLoadSuccess(data: MetricsTag[]): void;
  reset(): void;
}

const storeConfig: MetricsTagStoreDefinition = {
  unsubscribeListeners: [],
  metricsTags: {},

  init() {
    this.unsubscribeListeners.push(
      this.listenTo(MetricsTagActions.loadMetricsTagsSuccess, this.onLoadSuccess)
    );
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

const MetricsTagStore = createStore(makeSafeRefluxStore(storeConfig)) as Store &
  MetricsTagStoreDefinition;

export default MetricsTagStore;
