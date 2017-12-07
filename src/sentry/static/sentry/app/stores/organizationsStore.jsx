import Reflux from 'reflux';

import OrganizationsActions from '../actions/organizationsActions';

const OrganizationsStore = Reflux.createStore({
  listenables: [OrganizationsActions],

  // So we can use Reflux.connect in a component mixin
  getInitialState() {
    return this.items;
  },

  init() {
    this.items = [];
  },

  onRemoveSuccess(slug) {
    this.remove(slug);
  },

  get(slug) {
    return this.items.find(item => item.slug === slug);
  },

  getAll() {
    return this.items;
  },

  remove(slug) {
    this.items = this.items.filter(item => slug !== item.slug);
    this.trigger(this.items);
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
    this.trigger(this.items);
  },

  load(items) {
    this.items = items;
    this.trigger(items);
  },
});

export default OrganizationsStore;
