import {createStore} from 'reflux';

import {Indicator} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';

import {CommonStoreDefinition} from './types';

interface InternalDefinition {
  items: any[];
  lastId: number;
}
interface IndicatorStoreDefinition
  extends CommonStoreDefinition<Indicator[]>,
    InternalDefinition {
  /**
   * When this method is called directly via older parts of the application,
   * we want to maintain the old behavior in that it is replaced (and not queued up)
   *
   * @param message Toast message to be displayed
   * @param type One of ['error', 'success', '']
   * @param options Options object
   */
  add(
    message: React.ReactNode,
    type?: Indicator['type'],
    options?: Indicator['options']
  ): Indicator;
  addError(message?: string): Indicator;
  /**
   * Alias for add()
   */
  addMessage(
    message: React.ReactNode,
    type: Indicator['type'],
    options?: Indicator['options']
  ): Indicator;
  addSuccess(message: string): Indicator;
  /**
   * Appends a message to be displayed in list of indicators
   *
   * @param message Toast message to be displayed
   * @param type One of ['error', 'success', '']
   * @param options Options object
   */
  append(
    message: React.ReactNode,
    type: Indicator['type'],
    options?: Indicator['options']
  ): Indicator;
  /**
   * Remove all current indicators.
   */
  clear(): void;
  init(): void;
  /**
   * Remove an indicator
   */
  remove(indicator: Indicator): void;
}

const storeConfig: IndicatorStoreDefinition = {
  items: [],
  lastId: 0,

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.items = [];
    this.lastId = 0;
  },

  addSuccess(message) {
    return this.add(message, 'success', {duration: 2000});
  },

  addError(message = t('An error occurred')) {
    return this.add(message, 'error', {duration: 2000});
  },

  addMessage(message, type, {append, ...options} = {}) {
    const indicator: Indicator = {
      id: this.lastId++,
      message,
      type,
      options,
      clearId: null,
    };

    if (options.duration) {
      indicator.clearId = window.setTimeout(() => {
        this.remove(indicator);
      }, options.duration);
    }

    const newItems = append ? [...this.items, indicator] : [indicator];

    this.items = newItems;
    this.trigger(this.items);
    return indicator;
  },

  append(message, type, options) {
    return this.addMessage(message, type, {
      ...options,
      append: true,
    });
  },

  add(message, type = 'loading', options = {}) {
    return this.addMessage(message, type, {
      ...options,
      append: false,
    });
  },

  clear() {
    this.items = [];
    this.trigger(this.items);
  },

  remove(indicator) {
    if (!indicator) {
      return;
    }

    this.items = this.items.filter(item => item !== indicator);

    if (indicator.clearId) {
      window.clearTimeout(indicator.clearId);
      indicator.clearId = null;
    }

    this.trigger(this.items);
  },

  getState() {
    return this.items;
  },
};

const IndicatorStore = createStore(storeConfig);
export default IndicatorStore;
