import Reflux from 'reflux';

import GroupStore from 'sentry/stores/groupStore';
import {makeSafeRefluxStore, SafeStoreDefinition} from 'sentry/utils/makeSafeRefluxStore';

type SelectedGroupStoreInterface = {
  add(ids: string[]): void;
  allSelected(): boolean;
  anySelected(): boolean;
  deselectAll(): void;
  getSelectedIds(): Set<string>;
  init(): void;
  isSelected(itemId: string): boolean;
  multiSelected(): boolean;
  numSelected(): number;
  onGroupChange(itemIds: string[]): void;
  prune(): void;
  toggleSelect(itemId: string): void;
  toggleSelectAll(): void;
};

type Internals = {
  records: Record<string, boolean>;
};

const storeConfig: Reflux.StoreDefinition &
  Internals &
  SelectedGroupStoreInterface &
  SafeStoreDefinition = {
  records: {},
  unsubscribeListeners: [],

  init() {
    this.records = {};

    this.unsubscribeListeners.push(
      this.listenTo(GroupStore, this.onGroupChange, this.onGroupChange)
    );
  },

  onGroupChange(itemIds) {
    this.prune();
    this.add(itemIds);
    this.trigger();
  },

  add(ids) {
    const allSelected = this.allSelected();
    ids.forEach(id => {
      if (!this.records.hasOwnProperty(id)) {
        this.records[id] = allSelected;
      }
    });
  },

  prune() {
    const existingIds = new Set(GroupStore.getAllItemIds());

    // Remove ids that no longer exist
    for (const itemId in this.records) {
      if (!existingIds.has(itemId)) {
        delete this.records[itemId];
      }
    }
  },

  allSelected() {
    const itemIds = this.getSelectedIds();
    const numRecords = this.numSelected();

    return itemIds.size > 0 && itemIds.size === numRecords;
  },

  numSelected() {
    return Object.keys(this.records).length;
  },

  anySelected() {
    const itemIds = this.getSelectedIds();
    return itemIds.size > 0;
  },

  multiSelected() {
    const itemIds = this.getSelectedIds();
    return itemIds.size > 1;
  },

  getSelectedIds() {
    const selected = new Set<string>();
    for (const itemId in this.records) {
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
    for (const itemId in this.records) {
      this.records[itemId] = false;
    }
    this.trigger();
  },

  toggleSelect(itemId) {
    if (!this.records.hasOwnProperty(itemId)) {
      return;
    }
    this.records[itemId] = !this.records[itemId];
    this.trigger();
  },

  toggleSelectAll() {
    const allSelected = !this.allSelected();

    for (const itemId in this.records) {
      this.records[itemId] = allSelected;
    }

    this.trigger();
  },
};

const SelectedGroupStore = Reflux.createStore(
  makeSafeRefluxStore(storeConfig)
) as Reflux.Store & SelectedGroupStoreInterface;

export default SelectedGroupStore;
