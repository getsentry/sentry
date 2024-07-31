import {createStore} from 'reflux';

import GroupStore from 'sentry/stores/groupStore';

import type {StrictStoreDefinition} from './types';

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

interface SelectedGroupStoreDefinition extends StrictStoreDefinition<InternalDefinition> {
  add(ids: string[]): void;
  allSelected(): boolean;
  anySelected(): boolean;
  deselectAll(): void;
  getSelectedIds(): Set<string>;
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
  state: {records: new Map(), lastSelected: null},

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.state = {records: new Map(), lastSelected: null};
  },

  getState() {
    return this.state;
  },

  onGroupChange(itemIds) {
    this.prune();
    this.add([...itemIds]);
    this.trigger();
  },

  add(ids) {
    const allSelected = this.allSelected();

    const newRecords = new Map(this.state.records);
    ids.filter(id => !newRecords.has(id)).forEach(id => newRecords.set(id, allSelected));
    this.state = {...this.state, records: newRecords};
  },

  prune() {
    const existingIds = new Set(GroupStore.getAllItemIds());

    // Remove everything that no longer exists
    const newRecords = new Map(this.state.records);
    [...this.state.records.keys()]
      .filter(id => !existingIds.has(id))
      .forEach(id => newRecords.delete(id));

    this.state = {...this.state, lastSelected: null, records: newRecords};
  },

  allSelected() {
    const itemIds = this.getSelectedIds();

    return itemIds.size > 0 && itemIds.size === this.state.records.size;
  },

  anySelected() {
    return this.getSelectedIds().size > 0;
  },

  multiSelected() {
    return this.getSelectedIds().size > 1;
  },

  getSelectedIds() {
    return new Set(
      [...this.state.records.keys()].filter(id => this.state.records.get(id))
    );
  },

  isSelected(itemId) {
    return !!this.state.records.get(itemId);
  },

  deselectAll() {
    const newRecords = new Map(this.state.records);
    this.state.records.forEach((_, id) => newRecords.set(id, false));
    this.state = {...this.state, records: newRecords};
    this.trigger();
  },

  toggleSelect(itemId) {
    if (!this.state.records.has(itemId)) {
      return;
    }

    const newSelectedState = !this.state.records.get(itemId);
    const newRecords = new Map(this.state.records);
    newRecords.set(itemId, newSelectedState);

    this.state = {...this.state, records: newRecords, lastSelected: itemId};
    this.trigger();
  },

  toggleSelectAll() {
    const allSelected = !this.allSelected();

    const newRecords = new Map(this.state.records);
    newRecords.forEach((_, id) => newRecords.set(id, allSelected));
    this.state = {...this.state, records: newRecords, lastSelected: null};
    this.trigger();
  },

  shiftToggleItems(itemId) {
    if (!this.state.records.has(itemId)) {
      return;
    }
    if (!this.state.lastSelected) {
      this.toggleSelect(itemId);
      return;
    }

    const ids = GroupStore.getAllItemIds();
    const lastIdx = ids.findIndex(id => id === this.state.lastSelected);
    const currentIdx = ids.findIndex(id => id === itemId);

    if (lastIdx === -1 || currentIdx === -1) {
      return;
    }

    const newValue = !this.state.records.get(itemId);
    const selected =
      lastIdx < currentIdx
        ? ids.slice(lastIdx, currentIdx)
        : ids.slice(currentIdx, lastIdx);

    const newRecords = new Map(this.state.records);
    [...selected, this.state.lastSelected, itemId]
      .filter(id => newRecords.has(id))
      .forEach(id => newRecords.set(id, newValue));

    this.state = {...this.state, records: newRecords, lastSelected: itemId};
    this.trigger();
  },
};

const SelectedGroupStore = createStore(storeConfig);
export default SelectedGroupStore;
