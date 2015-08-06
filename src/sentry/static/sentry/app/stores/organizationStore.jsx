import Reflux from "reflux";

var OrganizationStore = Reflux.createStore({
  init() {
    this.items = [];
  },

  get(slug) {
    for (var i = 0; i < this.items.length; i++) {
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

