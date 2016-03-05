import Reflux from 'reflux';

const OrganizationStore = Reflux.createStore({
  init() {
    this.items = [];
  },

  get(slug) {
    return this.items.find(item => item.slug === slug);
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

