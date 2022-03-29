import {createStore} from 'reflux';

import MetricsTagActions from 'sentry/actions/metricTagActions';
import {MetricsTag, MetricsTagCollection} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

type State = {
  isFetching: boolean;
  metricsTags: MetricsTagCollection;
};

type InternalDefinition = {
  isFetching: boolean;
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
  isFetching: false,

  init() {
    this.unsubscribeListeners.push(
      this.listenTo(MetricsTagActions.loadMetricsTagsSuccess, this.onLoadSuccess)
    );
  },

  reset() {
    this.metricsTags = {};
    this.isFetching = true;
    this.trigger(this.state);
  },

  getState() {
    const {metricsTags, isFetching} = this;
    return {metricsTags, isFetching};
  },

  onLoadSuccess(data) {
    const newTags = data.reduce<MetricsTagCollection>((acc, tag) => {
      acc[tag.key] = {
        ...tag,
      };

      return acc;
    }, {});

    this.metricsTags = {...this.metricsTags, ...newTags};
    this.isFetching = false;
    this.trigger(this.state);
  },
};

const MetricsTagStore = createStore(makeSafeRefluxStore(storeConfig));

export default MetricsTagStore;
