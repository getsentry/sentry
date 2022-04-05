import {createStore} from 'reflux';

import MetricsTagActions from 'sentry/actions/metricTagActions';
import {MetricsTag, MetricsTagCollection} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

type State = {
  /**
   * This is state for when tags fetched from the API are loaded
   */
  loaded: boolean;
  metricsTags: MetricsTagCollection;
};

interface MetricsTagStoreDefinition extends CommonStoreDefinition<State> {
  onLoadSuccess(data: MetricsTag[]): void;
  reset(): void;
}

const storeConfig: MetricsTagStoreDefinition = {
  unsubscribeListeners: [],
  state: {
    metricsTags: {},
    loaded: false,
  },

  init() {
    this.unsubscribeListeners.push(
      this.listenTo(MetricsTagActions.loadMetricsTagsSuccess, this.onLoadSuccess)
    );
  },

  reset() {
    this.state = {
      metricsTags: {},
      loaded: false,
    };
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },

  onLoadSuccess(data) {
    const newTags = data.reduce<MetricsTagCollection>((acc, tag) => {
      acc[tag.key] = {
        ...tag,
      };

      return acc;
    }, {});

    this.state = {
      metricsTags: {...this.state.metricsTags, ...newTags},
      loaded: true,
    };

    this.trigger(this.state);
  },
};

const MetricsTagStore = createStore(makeSafeRefluxStore(storeConfig));

export default MetricsTagStore;
