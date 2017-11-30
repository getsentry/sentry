import Reflux from 'reflux';

const OrganizationStore = Reflux.createStore({
  // So we can use Reflux.connect in a component mixin
  getInitialState() {
    return this.items;
  },

  init() {
    this.items = [];
  },

  get(slug) {
    return this.items.find(item => item.slug === slug);
  },

  getAll() {
    return this.items;
  },

  add(item) {
    let match = false;
    this.items.forEach((existing, idx) => {
      if (existing.id === item.id) {
        item = {...existing, ...item};
        this.items[idx] = item;
        match = true;
      }
    });
    if (!match) {
      this.items.push(item);
    }
    this.trigger([item]);
  },

  load(items) {
    this.items = items;
    this.trigger(items);
  },
});

export default OrganizationStore;
