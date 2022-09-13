import create from 'zustand';

import GroupStore from 'sentry/stores/groupStore';

type ComputedState = {
  /**
   * Are all groups currently selected?
   */
  allSelected: boolean;
  /**
   * Are any groups currently selected?
   */
  anySelected: boolean;
  /**
   * Are mulitple groups currently selected?
   */
  multiSelected: boolean;
  /**
   * The set of selected IDs
   */
  selectedIds: Set<string>;
};

type State = {
  /**
   * Add a set of group IDs. If everything is currently selecged new items will
   * also be selected.
   *
   * Passing `prune` will remove existing reocrds not in the ids list.
   */
  add(ids: string[], prune?: boolean): void;
  /**
   * Computed state values
   */
  computed: ComputedState;
  /**
   * Deselect all groups
   */
  deselectAll(): void;
  /**
   * The most recently toggled item
   */
  lastSelected: string | null;
  /**
   * Mapping of selected group IDs -> boolean they are selected
   */
  records: Record<string, boolean>;
  /**
   * Trigger a selection between the last selected group and the shift selected group
   */
  shiftToggleItems(itemId: string): void;
  /**
   * Toggle selection of a group
   */
  toggleSelect(itemId: string): void;
  /**
   * Toggle selection of all groups
   */
  toggleSelectAll(): void;
};

const useSelectedGroups = create<State>()((set, get) => ({
  records: {},
  lastSelected: null,
  computed: {
    get selectedIds() {
      const {records} = get();
      return new Set(Object.keys(records).filter(id => records[id]));
    },
    get anySelected() {
      return Object.values(get().records).some(selected => selected);
    },
    get allSelected() {
      const selectedList = Object.values(get().records);
      return selectedList.length > 0 && selectedList.every(selected => selected);
    },
    get multiSelected() {
      return get().computed.selectedIds.size > 1;
    },
  },
  add: (ids, prune) =>
    set(({records: currentRecords, computed}) => {
      const {allSelected} = computed;

      const entries = ids
        .filter(id => currentRecords[id] === undefined)
        .map(id => [id, allSelected]);

      // Prune existing entries if requested
      const existingEntries = !prune
        ? Object.entries(currentRecords)
        : Object.entries(currentRecords).filter(([id]) => ids.includes(id));

      const records = {
        ...Object.fromEntries(existingEntries),
        ...Object.fromEntries(entries),
      };

      return {records};
    }),
  toggleSelect: itemId =>
    set(({records: currentRecords}) => {
      const selected = !currentRecords[itemId];

      // Does nothing for invalid item IDs
      if (currentRecords[itemId] === undefined) {
        return currentRecords;
      }

      const records = {...currentRecords, [itemId]: selected};
      return {records, lastSelected: itemId};
    }),
  toggleSelectAll: () =>
    set(({records: currentRecords}) => {
      const allSelected = Object.values(currentRecords).every(selected => selected);
      return {
        lastSelected: null,
        records: Object.fromEntries(
          Object.keys(currentRecords).map(itemId => [itemId, !allSelected])
        ),
      };
    }),
  deselectAll: () =>
    set(({records: currentRecords}) => ({
      lastSelected: null,
      records: Object.fromEntries(
        Object.keys(currentRecords).map(itemId => [itemId, false])
      ),
    })),
  shiftToggleItems: itemId =>
    set(({records: currentRecords, lastSelected, toggleSelect}) => {
      if (currentRecords[itemId] === undefined) {
        return {};
      }

      if (lastSelected === null) {
        toggleSelect(itemId);
        return {};
      }

      const ids = GroupStore.getAllItemIds();
      const lastIdx = ids.findIndex(id => id === lastSelected);
      const currentIdx = ids.findIndex(id => id === itemId);

      if (lastIdx === -1 || currentIdx === -1) {
        return {};
      }

      const newValue = !currentRecords[itemId];
      const selected =
        lastIdx < currentIdx
          ? ids.slice(lastIdx, currentIdx)
          : ids.slice(currentIdx, lastIdx);

      const entries = [...selected, lastSelected, itemId]
        .filter(id => currentRecords[id] !== undefined)
        .map(id => [id, newValue]);

      const records = {...currentRecords, ...Object.fromEntries(entries)};

      return {lastSelected: itemId, records};
    }),
}));

GroupStore.listen(
  (itemIds: string[]) => useSelectedGroups.getState().add([...itemIds], true),
  undefined
);

export default useSelectedGroups;
