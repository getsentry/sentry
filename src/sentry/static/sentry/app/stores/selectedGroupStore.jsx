var Reflux = require("reflux");

var GroupStore = require("./groupStore");

var SelectedGroupStore = Reflux.createStore({
  init() {
    this.records = {};

    this.listenTo(GroupStore, this.onGroupChange, this.onGroupChange);
  },

  onGroupChange(itemIds) {
    this.prune();
    this.add(itemIds);
    this.trigger();
  },

  add(ids) {
    var allSelected = this.allSelected();
    ids.forEach((id) => {
      if (!this.records.hasOwnProperty(id)) {
        this.records[id] = allSelected;
      }
    });
  },

  prune() {
    var existingIds = new Set(GroupStore.getAllItemIds());

    // Remove ids that no longer exist
    for (var itemId in this.records) {
      if (!existingIds.has(itemId)) {
        delete this.records[itemId];
      }
    }
  },

  allSelected() {
    var itemIds = this.getSelectedIds();
    var numRecords = Object.keys(this.records).length;
    return itemIds.size > 0 && itemIds.size === numRecords;
  },

  anySelected() {
    var itemIds = this.getSelectedIds();
    return itemIds.size > 0;
  },

  multiSelected() {
    var itemIds = this.getSelectedIds();
    return itemIds.size > 1;
  },

  getSelectedIds() {
    var selected = new Set();
    for (var itemId in this.records) {
      if (this.records[itemId]) {
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
    this.trigger();
  },

  toggleSelect(itemId) {
    if (!this.records.hasOwnProperty(itemId)) return;
    this.records[itemId] = !this.records[itemId];
    this.trigger();
  },

  toggleSelectAll() {
    var allSelected = !this.allSelected();

    for (var itemId in this.records) {
      this.records[itemId] = allSelected;
    }

    this.trigger();
  }
});

module.exports = SelectedGroupStore;
