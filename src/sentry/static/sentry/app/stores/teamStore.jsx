/** @jsx React.DOM */

var Reflux = require("reflux");

var TeamStore = Reflux.createStore({
  init() {
    this.items = [];
  },

  loadInitialData(items) {
    this.items = items;
    this.trigger(this.items, 'initial');
  },

  getById(id) {
    id = '' + id;
    for (var i=0; i<this.items.length; i++) {
      if (this.items[i].id === id) {
        return this.items[i];
      }
    }
    return null;
  },

  getBySlug(slug) {
    for (var i=0; i<this.items.length; i++) {
      if (this.items[i].slug === slug) {
        return this.items[i];
      }
    }
    return null;
  },

  getActive() {
    return this.items.filter((item) => item.isMember);
  },

  getAll() {
    return this.items;
  }
});

module.exports = TeamStore;
