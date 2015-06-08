/** @jsx React.DOM */

var Reflux = require("reflux");

var GroupStore = require("./groupStore");

var SelectedGroupStore = Reflux.createStore({
  init() {
    this.allSelected = false;
    this.anySelected = false;
    this.multiSelected = false;

    this.records = {};

    this.listenTo(GroupStore, this.onGroupChange, this.onGroupChange);
  },

  onGroupChange(itemIds) {
    var existingIds = new Set(GroupStore.getAllItemIds());
    // prune ids that no longer exist
    for (var itemId in this.records) {
      if (!existingIds.has(itemId)) {
        delete this.records[itemId];
      }
    }
    itemIds.forEach((itemId) => {
      if (typeof this.records[itemId] === "undefined") {
        this.records[itemId] = this.allSelected;
      }
    });
    this.refresh();
    this.trigger();
  },

  refresh() {
    var itemIds = this.getSelectedIds();

    this.anySelected = itemIds.size > 0;
    this.multiSelected = itemIds.size > 1;
  },

  getSelectedIds() {
    var selected = new Set();
    for (var itemId in this.records) {
      if (this.records[itemId] === true) {
        selected.add(itemId);
      }
    }
    return selected;
  },

  isSelected(itemId) {
    return this.records[itemId] === true;
  },

  clearAll() {
    this.records = {};
    this.allSelected = false;
    this.refresh();
    this.trigger();
  },

  toggleSelect(itemId) {
    this.records[itemId] = !this.records[itemId];
    this.refresh();
    this.trigger();
  },

  toggleSelectAll() {
    this.allSelected = !this.allSelected;
    for (var itemId in this.records) {
      this.records[itemId] = this.allSelected;
    }
    this.refresh();
    this.trigger();
  },

});

module.exports = SelectedGroupStore;
