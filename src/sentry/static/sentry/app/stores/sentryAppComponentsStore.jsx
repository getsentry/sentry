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

  getComponentByType(type) {
    if (!type) {
      return this.getAll();
    }
    return this.items.filter(item => item.type == type);
  },
});

export default SentryAppComponentsStore;
