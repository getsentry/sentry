/** @jsx React.DOM */

var Reflux = require("reflux");

var TeamActions = require("../actions/teamActions");

var TeamStore = Reflux.createStore({
  init() {
    this.items = [];

    this.listenTo(TeamActions.updateSuccess, this.onUpdateSuccess);
  },

  loadInitialData(items) {
    this.items = items;
    this.trigger(this.items, 'initial');
  },

  onUpdateSuccess(changeId, itemId, response) {
    if (!response) {
      return;
    }
    var item = this.getBySlug(itemId);
    if (!item) {
      this.items.push(response);
    } else {
      $.extend(true, item, response);
    }
    this.trigger(this.items, 'update');
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
