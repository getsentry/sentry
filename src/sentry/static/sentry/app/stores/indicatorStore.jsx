import Reflux from 'reflux';

import {t} from 'app/locale';
import IndicatorActions from 'app/actions/indicatorActions';

const IndicatorStore = Reflux.createStore({
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
    const indicator = {
      id: this.lastId++,
      message,
      type,
      options,
      clearId: null,
    };

    if (options.duration) {
      indicator.clearId = setTimeout(() => {
        this.remove(indicator);
      }, options.duration);
    }

    const newItems = append ? [...this.items, indicator] : [indicator];

    this.items = newItems;
    this.trigger(this.items);
    return indicator;
  },

  /**
   * Appends a message to be displayed in list of indicators
   *
   * @param {String} message Toast message to be displayed
   * @param {String} type One of ['error', 'success', '']
   * @param {Object} options Options object
   * @param {Number} options.duration Duration the toast should be displayed
   */
  append(message, type, options) {
    return this.addMessage(message, type, {
      ...options,
      append: true,
    });
  },

  /**
   * When this method is called directly via older parts of the application,
   * we want to maintain the old behavior in that it is replaced (and not queued up)
   *
   * @param {String} message Toast message to be displayed
   * @param {String} type One of ['error', 'success', '']
   * @param {Object} options Options object
   * @param {Number} options.duration Duration the toast should be displayed
   */
  add(message, type = 'loading', options) {
    return this.addMessage(message, type, {
      ...options,
      append: false,
    });
  },

  // Clear all indicators
  clear() {
    this.items = [];
    this.trigger(this.items);
  },

  // Remove a single indicator
  remove(indicator) {
    if (!indicator) {
      return;
    }

    this.items = this.items.filter(item => item !== indicator);

    if (indicator.clearId) {
      window.clearTimeout(indicator.options.clearId);
      indicator.options.clearId = null;
    }

    this.trigger(this.items);
  },
});

export default IndicatorStore;
