import Reflux from 'reflux';
import GroupStore from './groupStore';

const SelectedGroupStore = Reflux.createStore({
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
    let allSelected = this.allSelected();
    ids.forEach((id) => {
      if (!this.records.hasOwnProperty(id)) {
        this.records[id] = allSelected;
      }
    });
  },

  prune() {
    let existingIds = new Set(GroupStore.getAllItemIds());

    // Remove ids that no longer exist
    for (let itemId in this.records) {
      if (!existingIds.has(itemId)) {
        delete this.records[itemId];
      }
    }
  },

  allSelected() {
    let itemIds = this.getSelectedIds();
    let numRecords = this.numSelected();
    return itemIds.size > 0 && itemIds.size === numRecords;
  },

  numSelected() {
    return Object.keys(this.records).length;
  },

  anySelected() {
    let itemIds = this.getSelectedIds();
    return itemIds.size > 0;
  },

  multiSelected() {
    let itemIds = this.getSelectedIds();
    return itemIds.size > 1;
  },

  getSelectedIds() {
    let selected = new Set();
    for (let itemId in this.records) {
      if (this.records[itemId]) {
        selected.add(itemId);
      }
    }
    return selected;
  },

  isSelected(itemId) {
    return this.records[itemId] === true;
  },

  deselectAll() {
    for (let itemId in this.records) {
      this.records[itemId] = false;
    }
    this.trigger();
  },

  toggleSelect(itemId) {
    if (!this.records.hasOwnProperty(itemId)) return;
    this.records[itemId] = !this.records[itemId];
    this.trigger();
  },

  toggleSelectAll() {
    let allSelected = !this.allSelected();

    for (let itemId in this.records) {
      this.records[itemId] = allSelected;
    }

    this.trigger();
  }
});

export default SelectedGroupStore;

