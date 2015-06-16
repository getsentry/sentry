
var Reflux = require("reflux");

// var MemberActions = require('../actions/groupActions');

var MemberListStore = Reflux.createStore({
  // listenables: MemberActions,

  init() {
    this.items = [];
  },

  // TODO(dcramer): this should actually come from an action of some sorts
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

  getByEmail(email) {
    email = email.toLowerCase();
    for (var i=0; i<this.items.length; i++) {
      if (this.items[i].email.toLowerCase() === email) {
        return this.items[i];
      }
    }
    return null;
  },

  getAll() {
    return this.items;
  }
});

module.exports = MemberListStore;
