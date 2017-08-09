import Reflux from 'reflux';

const EnvironmentStore = Reflux.createStore({
  init() {
    this.items = [];
  },

  loadInitialData(items) {
    this.items = items;
    this.trigger(this.items, 'initial');
  },

  getByName(name) {
    name = '' + name;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].name === name) {
        return this.items[i];
      }
    }
    return null;
  },

  getAll() {
    return this.items;
  }
});

export default EnvironmentStore;
