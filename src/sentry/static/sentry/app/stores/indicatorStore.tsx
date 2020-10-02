import Reflux from 'reflux';

import {t} from 'app/locale';
import {Indicator} from 'app/actionCreators/indicator';
import IndicatorActions from 'app/actions/indicatorActions';

type IndicatorStoreInterface = {
  init: () => void;
  addSuccess: (message: string) => Indicator;
  addError: (message?: string) => Indicator;
  /**
   * Appends a message to be displayed in list of indicators
   *
   * @param message Toast message to be displayed
   * @param type One of ['error', 'success', '']
   * @param options Options object
   */
  append: (
    message: string,
    type: Indicator['type'],
    options?: Indicator['options']
  ) => Indicator;
  /**
   * When this method is called directly via older parts of the application,
   * we want to maintain the old behavior in that it is replaced (and not queued up)
   *
   * @param message Toast message to be displayed
   * @param type One of ['error', 'success', '']
   * @param options Options object
   */
  add: (
    message: string,
    type?: Indicator['type'],
    options?: Indicator['options']
  ) => Indicator;
  /**
   * Alias for add()
   */
  addMessage: (
    message: string,
    type: Indicator['type'],
    options?: Indicator['options']
  ) => Indicator;

  /**
   * Remove all current indicators.
   */
  clear: () => void;

  /**
   * Remove an indicator
   */
  remove: (indicator: Indicator) => void;
};

type Internals = {
  items: any[];
  lastId: number;
};

const storeConfig: Reflux.StoreDefinition & IndicatorStoreInterface & Internals = {
  items: [],
  lastId: 0,
  init() {
    this.items = [];
    this.lastId = 0;
    this.listenTo(IndicatorActions.append, this.append);
    this.listenTo(IndicatorActions.replace, this.add);
    this.listenTo(IndicatorActions.remove, this.remove);
    this.listenTo(IndicatorActions.clear, this.clear);
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
};

type IndicatorStore = Reflux.Store & IndicatorStoreInterface;

export default Reflux.createStore(storeConfig) as IndicatorStore;
