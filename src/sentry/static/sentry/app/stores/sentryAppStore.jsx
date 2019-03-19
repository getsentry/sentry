import Reflux from 'reflux';

const SentryAppStore = Reflux.createStore({
  init() {
    this.items = [];
  },

  getInitialState() {
    return this.items;
  },

  load(items) {
    this.items = items;
    this.trigger(items);
  },

  get(slug) {
    return this.items.find(item => item.slug === slug);
  },

  getAll() {
    return this.items;
  },
});

export default SentryAppStore;
