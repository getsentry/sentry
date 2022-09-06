import {createStore} from 'reflux';

import GroupStore from 'sentry/stores/groupStore';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

interface InternalDefinition {
  /**
   * The last item to have been selected
   */
  lastSelected: string | null;
  /**
   * Mapping of item ID -> if it is selected. This is a map to
   * make it easier to track if everything has been selected or not.
   */
  records: Map<string, boolean>;
}

interface SelectedGroupStoreDefinition
  extends CommonStoreDefinition<Map<string, boolean>>,
    InternalDefinition {
  add(ids: string[]): void;
  allSelected(): boolean;
  anySelected(): boolean;
  deselectAll(): void;
  getSelectedIds(): Set<string>;
  init(): void;
  isSelected(itemId: string): boolean;
  multiSelected(): boolean;
  onGroupChange(itemIds: Set<string>): void;
  prune(): void;
  reset(): void;
  shiftToggleItems(itemId: string): void;
  toggleSelect(itemId: string): void;
  toggleSelectAll(): void;
}

const storeConfig: SelectedGroupStoreDefinition = {
  records: new Map(),
  lastSelected: null,
  unsubscribeListeners: [],

  init() {
    this.reset();

    this.unsubscribeListeners.push(
      this.listenTo(GroupStore, this.onGroupChange, this.onGroupChange)
    );
  },

  reset() {
    this.records = new Map();
    this.lastSelected = null;
  },

  getState() {
    return this.records;
  },

  onGroupChange(itemIds) {
    this.prune();
    this.add([...itemIds]);
    this.trigger();
  },

  add(ids) {
    const allSelected = this.allSelected();

    ids
      .filter(id => !this.records.has(id))
      .forEach(id => this.records.set(id, allSelected));
  },

  prune() {
    const existingIds = new Set(GroupStore.getAllItemIds());
    this.lastSelected = null;

    // Remove everything that no longer exists
    [...this.records.keys()]
      .filter(id => !existingIds.has(id))
      .forEach(id => this.records.delete(id));
  },

  allSelected() {
    const itemIds = this.getSelectedIds();

    return itemIds.size > 0 && itemIds.size === this.records.size;
  },

  numSelected() {
    return this.getSelectedIds().size;
  },

  anySelected() {
    return this.getSelectedIds().size > 0;
  },

  multiSelected() {
    return this.getSelectedIds().size > 1;
  },

  getSelectedIds() {
    return new Set([...this.records.keys()].filter(id => this.records.get(id)));
  },

  isSelected(itemId) {
    return !!this.records.get(itemId);
  },

  deselectAll() {
    this.records.forEach((_, id) => this.records.set(id, false));
    this.trigger();
  },

  toggleSelect(itemId) {
    if (!this.records.has(itemId)) {
      return;
    }

    const newState = !this.records.get(itemId);
    this.records.set(itemId, newState);

    if (newState) {
      this.lastSelected = itemId;
    }
    this.trigger();
  },

  toggleSelectAll() {
    const allSelected = !this.allSelected();
    this.lastSelected = null;

    this.records.forEach((_, id) => this.records.set(id, allSelected));
    this.trigger();
  },

  shiftToggleItems(itemId) {
    if (!this.records.has(itemId)) {
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

    const newValue = !this.records.get(itemId);
    const selected =
      lastIdx < currentIdx
        ? ids.slice(lastIdx, currentIdx)
        : ids.slice(currentIdx, lastIdx);

    [...selected, this.lastSelected, itemId]
      .filter(id => this.records.has(id))
      .forEach(id => this.records.set(id, newValue));

    this.lastSelected = itemId;
    this.trigger();
  },
};

const SelectedGroupStore = createStore(makeSafeRefluxStore(storeConfig));
export default SelectedGroupStore;
