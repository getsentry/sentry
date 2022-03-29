import {createStore} from 'reflux';

import MetricsMetaActions from 'sentry/actions/metricsMetaActions';
import {MetricsMeta, MetricsMetaCollection} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

type State = {
  isFetching: boolean;
  metricsMeta: MetricsMetaCollection;
};

type InternalDefinition = {
  isFetching: boolean;
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
  isFetching: false,

  init() {
    this.unsubscribeListeners.push(
      this.listenTo(MetricsMetaActions.loadMetricsMetaSuccess, this.onLoadSuccess)
    );
  },

  reset() {
    this.metricsMeta = {};
    this.isFetching = true;
    this.trigger(this.state);
  },

  getState() {
    const {metricsMeta, isFetching} = this;
    return {metricsMeta, isFetching};
  },

  onLoadSuccess(data) {
    const newFields = data.reduce<MetricsMetaCollection>((acc, field) => {
      acc[field.name] = {
        ...field,
      };

      return acc;
    }, {});

    this.metricsMeta = {...this.metricsMeta, ...newFields};
    this.isFetching = false;
    this.trigger(this.state);
  },
};

const MetricsMetaStore = createStore(makeSafeRefluxStore(storeConfig));

export default MetricsMetaStore;
