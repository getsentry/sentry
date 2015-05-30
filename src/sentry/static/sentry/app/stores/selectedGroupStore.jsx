/** @jsx React.DOM */

var Reflux = require("reflux");

var GroupListStore = require("./groupStore");

var SelectedGroupStore = Reflux.createStore({
  init() {
    this.listenTo(GroupListStore, this.onAggListChange);

    this.allSelected = false;
    this.anySelected = false;
    this.multiSelected = false;

    this.selected = new Set();
  },

  onAggListChange() {
    var existingIds = new Set(GroupListStore.getAllItemIds());
    // prune ids that no longer exist
    this.selected.forEach((itemId) => {
      if (!existingIds.has(itemId)) {
        this.selected.delete(itemId);
      }
    });
    this.trigger();
  },

  refresh() {
    var itemIds = this.getSelectedIds();

    this.anySelected = itemIds.size > 0;
    this.multiSelected = itemIds.size > 1;
  },

  getSelectedIds() {
    if (this.allSelected) {
      return new Set(GroupListStore.getAllItemIds());
    }
    return this.selected;
  },

  isSelected(itemId) {
    return this.selected.has(itemId);
  },

  clearAll() {
    this.selected.clear();
    this.allSelected = false;
    this.refresh();
    this.trigger();
  },

  toggleSelect(itemId) {
    if (this.selected.has(itemId)) {
      this.selected.delete(itemId);
    } else {
      this.selected.add(itemId);
    }
    this.refresh();
    this.trigger();
  },

  toggleSelectAll() {
    this.allSelected = !this.allSelected;
    GroupListStore.getAllItemIds().forEach((itemId) => {
      if (this.allSelected) {
        this.selected.add(itemId);
      } else {
        this.selected.delete(itemId);
      }
    });
    this.refresh();
    this.trigger();
  },

});

module.exports = SelectedGroupStore;
