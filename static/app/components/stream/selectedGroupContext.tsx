import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import GroupStore from 'sentry/stores/groupStore';

type Context = {
  /**
   * Add a set of group IDs. If everything is currently selecged new items will
   * also be selected.
   *
   * Passing `prune` will remove existing reocrds not in the ids list.
   */
  add(ids: string[], prune?: boolean): void;
  /**
   * Are all groups currently selected?
   */
  allSelected: boolean;
  /**
   * Are any groups currently selected?
   */
  anySelected: boolean;
  /**
   * Deselect all groups
   */
  deselectAll(): void;
  /**
   * Are mulitple groups currently selected?
   */
  multiSelected: boolean;
  /**
   * Mapping of selected group IDs -> boolean they are selected
   */
  records: Record<string, boolean>;
  /**
   * The set of selected IDs
   */
  selectedIds: Set<string>;
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

const SelectedGroupContext = createContext<Context | null>(null);

type Props = {
  children: React.ReactNode;
};

function SelectedGroupProvider({children}: Props) {
  const [records, setRecords] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(
    () => new Set(Object.keys(records).filter(id => records[id])),
    [records]
  );

  const anySelected = selectedIds.size > 0;
  const multiSelected = selectedIds.size > 1;
  const allSelected = anySelected && Object.keys(records).length === selectedIds.size;

  const lastSelected = useRef<string | null>(null);

  const add = useCallback(
    (ids: string[], prune?: boolean) =>
      setRecords(currentRecords => {
        const entries = ids
          .filter(id => currentRecords[id] === undefined)
          .map(id => [id, allSelected]);

        // Prune existing entries if requested
        const existingEntries = !prune
          ? Object.entries(currentRecords)
          : Object.entries(currentRecords).filter(([id]) => ids.includes(id));

        return {...Object.fromEntries(existingEntries), ...Object.fromEntries(entries)};
      }),
    [allSelected]
  );

  // Listen for changes to the group store to update records
  useEffect(() => {
    const unsubscribe = GroupStore.listen(
      (itemIds: Set<string>) => add([...itemIds], true),
      undefined
    );

    return () => unsubscribe();
  }, [add]);

  const toggleSelect = useCallback(
    (itemId: string) =>
      setRecords(currentRecords => {
        const selected = !currentRecords[itemId];

        if (selected) {
          lastSelected.current = itemId;
        }

        // Does nothing for invalid item IDs
        if (currentRecords[itemId] === undefined) {
          return currentRecords;
        }

        return {...currentRecords, [itemId]: selected};
      }),
    []
  );

  const toggleSelectAll = useCallback(() => {
    lastSelected.current = null;
    setRecords(currentRecords =>
      Object.fromEntries(
        Object.keys(currentRecords).map(itemId => [itemId, !allSelected])
      )
    );
  }, [allSelected]);

  const deselectAll = useCallback(() => {
    lastSelected.current = null;
    setRecords(currentRecords =>
      Object.fromEntries(Object.keys(currentRecords).map(itemId => [itemId, false]))
    );
  }, []);

  const shiftToggleItems = useCallback(
    (itemId: string) =>
      setRecords(currentRecords => {
        if (currentRecords[itemId] === undefined) {
          return currentRecords;
        }

        if (lastSelected.current === null) {
          toggleSelect(itemId);
          return currentRecords;
        }

        const ids = GroupStore.getAllItemIds();
        const lastIdx = ids.findIndex(id => id === lastSelected.current);
        const currentIdx = ids.findIndex(id => id === itemId);

        if (lastIdx === -1 || currentIdx === -1) {
          return currentRecords;
        }

        const newValue = !currentRecords[itemId];
        const selected =
          lastIdx < currentIdx
            ? ids.slice(lastIdx, currentIdx)
            : ids.slice(currentIdx, lastIdx);

        const entries = [...selected, lastSelected.current, itemId]
          .filter(id => currentRecords[id] !== undefined)
          .map(id => [id, newValue]);

        lastSelected.current = itemId;

        return {...currentRecords, ...Object.fromEntries(entries)};
      }),
    [toggleSelect]
  );

  const context = useMemo<Context>(
    () => ({
      add,
      allSelected,
      anySelected,
      deselectAll,
      multiSelected,
      records,
      selectedIds,
      toggleSelect,
      toggleSelectAll,
      shiftToggleItems,
    }),
    [
      add,
      allSelected,
      anySelected,
      deselectAll,
      multiSelected,
      records,
      selectedIds,
      toggleSelect,
      toggleSelectAll,
      shiftToggleItems,
    ]
  );

  return (
    <SelectedGroupContext.Provider value={context}>
      {children}
    </SelectedGroupContext.Provider>
  );
}

function useSelectedGroups() {
  const context = useContext(SelectedGroupContext);

  if (context === null) {
    throw new Error('useSelectedGroups called but SelectedGroupContext is not set.');
  }

  return context;
}

export {SelectedGroupProvider, useSelectedGroups};
