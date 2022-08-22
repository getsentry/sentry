import {createStore, StoreDefinition} from 'reflux';

import GroupStore from 'sentry/stores/groupStore';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

interface InternalDefinition {
  /**
   * The last item to have been selected
   */
  lastSelected: string | null;
  records: Record<string, boolean>;
}

interface SelectedGroupStoreDefinition extends StoreDefinition, InternalDefinition {
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
  shiftToggleItems(itemId: string): void;
  toggleSelect(itemId: string): void;
  toggleSelectAll(): void;
}

const storeConfig: SelectedGroupStoreDefinition = {
  records: {},
  lastSelected: null,
  unsubscribeListeners: [],

  init() {
    this.records = {};
    this.lastSelected = null;

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
    this.lastSelected = null;

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
    this.lastSelected = null;
    this.trigger();
  },

  toggleSelect(itemId) {
    if (!this.records.hasOwnProperty(itemId)) {
      return;
    }
    this.records[itemId] = !this.records[itemId];
    if (this.records[itemId]) {
      this.lastSelected = itemId;
    }
    this.trigger();
  },

  toggleSelectAll() {
    const allSelected = !this.allSelected();
    this.lastSelected = null;

    for (const itemId in this.records) {
      this.records[itemId] = allSelected;
    }

    this.trigger();
  },

  shiftToggleItems(itemId) {
    if (!this.records.hasOwnProperty(itemId)) {
      return;
    }
    if (!this.lastSelected) {
      this.toggleSelect(itemId);
      return;
    }

    const ids = GroupStore.getAllItemIds();
    const lastIdx = ids.findIndex(id => id === this.lastSelected);
    const currentIdx = ids.findIndex(id => id === itemId);

    if (lastIdx === -1 || currentIdx === -1) {
      return;
    }

    const newValue = !this.records[itemId];
    const selected =
      lastIdx < currentIdx
        ? ids.slice(lastIdx, currentIdx)
        : ids.slice(currentIdx, lastIdx);
    [...selected, this.lastSelected, itemId].forEach(id => {
      if (this.records.hasOwnProperty(id)) {
        this.records[id] = newValue;
      }
    });
    this.lastSelected = itemId;
    this.trigger();
  },
};

const SelectedGroupStore = createStore(makeSafeRefluxStore(storeConfig));
export default SelectedGroupStore;
