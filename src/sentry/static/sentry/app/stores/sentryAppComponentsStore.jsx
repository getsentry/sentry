import Reflux from 'reflux';

const SentryAppComponentsStore = Reflux.createStore({
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

  get(uuid) {
    return this.items.find(item => item.uuid === uuid);
  },

  getAll() {
    return this.items;
  },

  getStacktraceLinkComponents() {
    return this.items.filter(item => item.type == 'stacktrace-link');
  },
});

export default SentryAppComponentsStore;
