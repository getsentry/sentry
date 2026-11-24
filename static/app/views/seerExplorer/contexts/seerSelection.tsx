import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import isEqual from 'lodash/isEqual';

import {tn} from 'sentry/locale';

import {LLM_CONTEXT_MAX_ROWS} from './llmContext';
import type {LLMContextNodeSnapshot, LLMContextSnapshot} from './llmContextTypes';

const SELECTION_LABELS = {
  issue: (count: number) => tn('%s issue', '%s issues', count),
  replay: (count: number) => tn('%s replay', '%s replays', count),
  monitor: (count: number) => tn('%s monitor', '%s monitors', count),
  alert: (count: number) => tn('%s alert', '%s alerts', count),
} satisfies Record<string, (count: number) => string>;

type SeerSelectionItemType = keyof typeof SELECTION_LABELS;

/**
 * Rows the user selected in a table, as a table reports them to Seer.
 */
export interface SeerSelection {
  /** How many rows are selected. Can exceed `items` when every matching row is selected. */
  count: number;
  itemType: SeerSelectionItemType;
  /** The selected rows the page has loaded, as the table shows them. */
  items: Array<Record<string, unknown>>;
  /** Every row matching the current query is selected, not only the loaded ones. */
  allSelected?: boolean;
}

interface SeerSelectionState {
  /** Whether the selection goes to Seer with the page context. */
  isIncluded: boolean;
  selection: SeerSelection | null;
}

const INITIAL_STATE: SeerSelectionState = {selection: null, isIncluded: true};

function createSeerSelectionStore() {
  let state = INITIAL_STATE;
  let ownerId: string | null = null;
  const listeners = new Set<() => void>();

  const setState = (next: SeerSelectionState) => {
    if (next.selection === state.selection && next.isIncluded === state.isIncluded) {
      return;
    }
    state = next;
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish: (owner: string, selection: SeerSelection | null) => {
      if (selection === null) {
        if (ownerId !== owner) {
          return;
        }
        ownerId = null;
        // A new selection starts out included, whatever the last one was set to.
        setState(INITIAL_STATE);
        return;
      }
      ownerId = owner;
      if (!isEqual(selection, state.selection)) {
        setState({...state, selection});
      }
    },
    setIncluded: (isIncluded: boolean) => setState({...state, isIncluded}),
  };
}

type SeerSelectionStore = ReturnType<typeof createSeerSelectionStore>;

const SeerSelectionContext = createContext<SeerSelectionStore | null>(null);

/**
 * Holds the table selection that Seer can receive with the page context.
 * Tables write it with `usePublishSeerSelection`; the Seer composer reads it.
 */
export function SeerSelectionProvider({children}: {children: ReactNode}) {
  const [store] = useState(createSeerSelectionStore);
  return <SeerSelectionContext value={store}>{children}</SeerSelectionContext>;
}

/**
 * Reports a table's selected rows to Seer. Pass `null` when nothing is selected.
 * The selection clears when the calling component unmounts.
 */
export function usePublishSeerSelection(selection: SeerSelection | null) {
  const store = useContext(SeerSelectionContext);
  const ownerId = useId();

  useEffect(() => {
    store?.publish(ownerId, selection);
  }, [store, ownerId, selection]);

  useEffect(() => () => store?.publish(ownerId, null), [store, ownerId]);
}

/**
 * The current selection and whether it is included, for the composer's toggle.
 */
export function useSeerSelection() {
  const store = useContext(SeerSelectionContext);
  const state = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getState ?? getInitialState,
    store?.getState ?? getInitialState
  );
  const setIncluded = useCallback(
    (isIncluded: boolean) => store?.setIncluded(isIncluded),
    [store]
  );
  return {...state, setIncluded};
}

/**
 * Adds the selection to a page context snapshot when it is included.
 * Read at send time, so it never re-renders the caller.
 */
export function useAddSeerSelectionToSnapshot() {
  const store = useContext(SeerSelectionContext);
  return useCallback(
    (snapshot: LLMContextSnapshot): LLMContextSnapshot => {
      const state = store?.getState();
      if (!state?.selection || !state.isIncluded) {
        return snapshot;
      }
      return {
        ...snapshot,
        nodes: [...snapshot.nodes, toSelectionNode(snapshot, state.selection)],
      };
    },
    [store]
  );
}

export function getSeerSelectionLabel({count, itemType}: SeerSelection): string {
  return SELECTION_LABELS[itemType](count);
}

/**
 * How a selectable table describes its rows to Seer. Tables opt in by passing this
 * to their selection provider; tables without it never share their selection.
 */
export interface SeerTableSelectionConfig<T extends {id: string}> {
  itemType: SeerSelectionItemType;
  /** The rows the page has loaded. */
  rows: readonly T[];
  /** The fields Seer gets for a selected row. Keep it a stable function. */
  toSummary: (row: T) => Record<string, unknown>;
  /** How many rows match the query, when the table knows it, for "select all N matching". */
  total?: number;
}

/**
 * Reports a table's selected rows to Seer, from the ids its selection state holds.
 * `'all'` means every loaded row; `allSelected` means every row matching the query.
 */
export function useSeerTableSelection<T extends {id: string}>(
  config: SeerTableSelectionConfig<T> | undefined,
  selectedIds: 'all' | ReadonlySet<string>,
  allInQuerySelected?: boolean
) {
  const allSelected = allInQuerySelected ?? selectedIds === 'all';
  const rows = config?.rows;
  const toSummary = config?.toSummary;
  const itemType = config?.itemType;
  const total = config?.total;

  const selection = useMemo((): SeerSelection | null => {
    if (!rows || !toSummary || !itemType) {
      return null;
    }
    const selectedRows =
      selectedIds === 'all' ? rows : rows.filter(row => selectedIds.has(row.id));
    if (selectedRows.length === 0) {
      return null;
    }
    return {
      itemType,
      count:
        allSelected && total !== undefined
          ? Math.max(total, selectedRows.length)
          : selectedRows.length,
      allSelected,
      items: selectedRows.slice(0, LLM_CONTEXT_MAX_ROWS).map(toSummary),
    };
  }, [allSelected, itemType, rows, selectedIds, toSummary, total]);

  usePublishSeerSelection(selection);
}

function toSelectionNode(
  snapshot: LLMContextSnapshot,
  {allSelected, count, itemType, items}: SeerSelection
): LLMContextNodeSnapshot {
  // The backend renders only the root nodes at the highest priority, so match it.
  const priority = Math.max(0, ...snapshot.nodes.map(node => node.priority));
  return {
    nodeType: 'selection',
    priority,
    data: {
      contextHint:
        `Rows the user selected in the ${itemType} table on this page. ` +
        'When the user refers to "these", "the selected ones" or "this", they most likely mean these rows. ' +
        `selectedCount is how many rows are selected; selectedItems lists up to ${LLM_CONTEXT_MAX_ROWS} of them.` +
        (allSelected
          ? ' Every row matching the current query is selected, including rows the page has not loaded.'
          : ''),
      itemType,
      selectedCount: count,
      allSelected: allSelected ?? false,
      selectedItems: items.slice(0, LLM_CONTEXT_MAX_ROWS),
    },
    children: [],
  };
}

function noopSubscribe() {
  return () => {};
}

function getInitialState() {
  return INITIAL_STATE;
}
