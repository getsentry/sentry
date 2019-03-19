import Reflux from 'reflux';

const SentryAppInstallationStore = Reflux.createStore({
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
});

export default SentryAppInstallationStore;
