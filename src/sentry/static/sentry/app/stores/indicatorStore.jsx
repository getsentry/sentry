import Reflux from 'reflux';
import {t} from '../locale';
import IndicatorActions from '../actions/indicatorActions';

const IndicatorStore = Reflux.createStore({
  init() {
    this.items = [];
    this.lastId = 0;
    this.listenTo(IndicatorActions.add, this.add);
    this.listenTo(IndicatorActions.remove, this.remove);
  },

  addSuccess(message) {
    return this.add(message, 'success', {duration: 2000});
  },

  addError(message = t('An error occurred')) {
    return this.add(message, 'error', {duration: 2000});
  },

  add(message, type, options) {
    options = options || {};

    let indicator = {
      id: this.lastId++,
      message,
      type,
      options,
    };

    if (options.duration) {
      options.clearId = setTimeout(() => {
        this.remove(indicator);
      }, options.duration);
    }
    this.items = [indicator]; // replace
    this.trigger(this.items);
    return indicator;
  },

  remove(indicator) {
    this.items = this.items.filter(item => {
      return item !== indicator;
    });

    if (indicator.options.clearId) {
      window.clearTimeout(indicator.options.clearId);
      indicator.options.clearId = null;
    }

    this.trigger(this.items);
  },
});

export default IndicatorStore;
