import Reflux from 'reflux';

const ReleaseStore = Reflux.createStore({
  init() {
    this.items = [];
    this.loaded = false;
  },

  loadInitialData(items) {
    this.items = items;
    this.loaded = true;
    this.trigger(this.items, 'initial');
  },

  reset() {
    this.items = [];
  },

  getAll() {
    return this.items;
  },
});

export default ReleaseStore;
