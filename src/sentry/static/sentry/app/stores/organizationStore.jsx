import Reflux from 'reflux';

const OrganizationStore = Reflux.createStore({
  init() {
    this.items = [];
  },

  get(slug) {
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].slug === slug) {
        return this.items[i];
      }
    }
  },

  getAll() {
    return this.items;
  },

  load(items) {
    this.items = items;
    this.trigger(items);
  }
});

export default OrganizationStore;

