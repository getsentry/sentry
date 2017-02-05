import jQuery from 'jquery';
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

  add(item) {
    let existing = this.get(item.slug);
    if (existing) {
      this.items.forEach((existing, idx) => {
        if (existing.id === item.id) {
          item = {...existing, ...item};
          this.items[idx] = item;
        }
      });
    } else {
      this.items.push(item);
    }
    this.trigger([item]);
  },

  load(items) {
    this.items = items;
    this.trigger(items);
  }
});

export default OrganizationStore;

