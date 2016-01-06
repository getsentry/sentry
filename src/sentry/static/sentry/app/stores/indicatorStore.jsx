import Reflux from 'reflux';

const IndicatorStore = Reflux.createStore({
  init() {
    this.items = [];
    this.lastId = 0;
  },

  add(message, type, options) {
    options = options || {};

    let indicator = {
      id: this.lastId++,
      message: message,
      type: type,
      options: options
    };

    if (options.duration) {
      setTimeout(() => {
        this.remove(indicator);
      }, options.duration);
    }
    this.items = [indicator]; // replace
    this.trigger(this.items);
    return indicator;
  },

  remove(indicator) {
    this.items = this.items.filter((item) => {
      return item !== indicator;
    });
    this.trigger(this.items);
  }
});

export default IndicatorStore;
