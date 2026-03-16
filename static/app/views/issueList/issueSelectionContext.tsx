import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useMemo, useReducer, useRef} from 'react';
import isEqual from 'lodash/isEqual';

interface IssueSelectionState {
  allInQuerySelected: boolean;
  lastSelected: string | null;
  records: Map<string, boolean>;
}

type IssueSelectionAction =
  | {groupIds: string[]; type: 'RECONCILE_VISIBLE_GROUP_IDS'}
  | {groupId: string; type: 'TOGGLE_SELECT'}
  | {groupId: string; type: 'SHIFT_TOGGLE_SELECT'; visibleGroupIds: string[]}
  | {type: 'TOGGLE_SELECT_ALL_VISIBLE'}
  | {type: 'DESELECT_ALL'}
  | {type: 'SET_ALL_IN_QUERY_SELECTED'; value: boolean};

interface IssueSelectionSummary extends IssueSelectionState {
  anySelected: boolean;
  multiSelected: boolean;
  pageSelected: boolean;
  selectedIdsSet: Set<string>;
}

interface IssueSelectionActions {
  deselectAll: () => void;
  reconcileVisibleGroupIds: (groupIds: string[]) => void;
  setAllInQuerySelected: (value: boolean) => void;
  shiftToggleSelect: (groupId: string) => void;
  toggleSelect: (groupId: string) => void;
  toggleSelectAllVisible: () => void;
}

type IssueSelectionProviderProps = {
  children: ReactNode;
  visibleGroupIds: string[];
};

const IssueSelectionSummaryContext = createContext<IssueSelectionSummary | null>(null);
const IssueSelectionActionsContext = createContext<IssueSelectionActions | null>(null);

function areAllSelected(records: Map<string, boolean>): boolean {
  let selectedCount = 0;
  for (const isSelected of records.values()) {
    if (isSelected) {
      selectedCount += 1;
    }
  }
  return selectedCount > 0 && selectedCount === records.size;
}

function createInitialState(visibleGroupIds: string[]): IssueSelectionState {
  return {
    records: new Map(visibleGroupIds.map(id => [id, false])),
    lastSelected: null,
    allInQuerySelected: false,
  };
}

/**
 * Align the selection map with the latest visible group ids.
 *
 * Existing ids keep their selection value, missing ids are dropped, and newly
 * visible ids inherit the page-level all-selected state so checkbox behavior
 * stays consistent across pagination/stream updates.
 */
function reconcileRecords(
  records: Map<string, boolean>,
  visibleGroupIds: string[]
): {changed: boolean; records: Map<string, boolean>} {
  const nextRecords = new Map(records);
  let changed = false;
  const existingIds = new Set(visibleGroupIds);

  for (const id of records.keys()) {
    if (!existingIds.has(id)) {
      nextRecords.delete(id);
      changed = true;
    }
  }

  const allSelected = areAllSelected(nextRecords);

  for (const id of visibleGroupIds) {
    if (!nextRecords.has(id)) {
      nextRecords.set(id, allSelected);
      changed = true;
    }
  }

  return {changed, records: nextRecords};
}

function issueSelectionReducer(
  state: IssueSelectionState,
  action: IssueSelectionAction
): IssueSelectionState {
  switch (action.type) {
    case 'RECONCILE_VISIBLE_GROUP_IDS': {
      // Reducer-level reconciliation keeps this transition idempotent regardless
      // of which caller triggers it.
      const {changed, records} = reconcileRecords(state.records, action.groupIds);
      if (!changed) {
        return state;
      }

      return {
        ...state,
        allInQuerySelected: false,
        records,
        lastSelected: null,
      };
    }
    case 'TOGGLE_SELECT': {
      if (!state.records.has(action.groupId)) {
        return state;
      }

      const nextRecords = new Map(state.records);
      nextRecords.set(action.groupId, !nextRecords.get(action.groupId));

      return {
        ...state,
        allInQuerySelected: false,
        records: nextRecords,
        lastSelected: action.groupId,
      };
    }
    case 'SHIFT_TOGGLE_SELECT': {
      if (!state.records.has(action.groupId)) {
        return state;
      }

      if (!state.lastSelected) {
        const nextRecords = new Map(state.records);
        nextRecords.set(action.groupId, !nextRecords.get(action.groupId));
        return {
          ...state,
          allInQuerySelected: false,
          records: nextRecords,
          lastSelected: action.groupId,
        };
      }

      const ids = action.visibleGroupIds;
      const lastIndex = ids.indexOf(state.lastSelected);
      const currentIndex = ids.indexOf(action.groupId);

      if (lastIndex === -1 || currentIndex === -1) {
        return state;
      }

      const nextRecords = new Map(state.records);
      const nextValue = !nextRecords.get(action.groupId);
      const inBetweenIds =
        lastIndex < currentIndex
          ? ids.slice(lastIndex, currentIndex)
          : ids.slice(currentIndex, lastIndex);

      for (const id of [...inBetweenIds, state.lastSelected, action.groupId]) {
        if (nextRecords.has(id)) {
          nextRecords.set(id, nextValue);
        }
      }

      return {
        ...state,
        allInQuerySelected: false,
        records: nextRecords,
        lastSelected: action.groupId,
      };
    }
    case 'TOGGLE_SELECT_ALL_VISIBLE': {
      const nextRecords = new Map(state.records);
      const nextValue = !areAllSelected(state.records);
      nextRecords.forEach((_, id) => nextRecords.set(id, nextValue));

      return {
        ...state,
        allInQuerySelected: false,
        records: nextRecords,
        lastSelected: null,
      };
    }
    case 'DESELECT_ALL': {
      const nextRecords = new Map(state.records);
      nextRecords.forEach((_, id) => nextRecords.set(id, false));

      return {
        ...state,
        allInQuerySelected: false,
        records: nextRecords,
      };
    }
    case 'SET_ALL_IN_QUERY_SELECTED':
      return {...state, allInQuerySelected: action.value};
    default:
      return state;
  }
}

export function IssueSelectionProvider({
  children,
  visibleGroupIds,
}: IssueSelectionProviderProps) {
  const [state, dispatch] = useReducer(
    issueSelectionReducer,
    visibleGroupIds,
    createInitialState
  );
  const previousVisibleGroupIdsRef = useRef(visibleGroupIds);

  if (!isEqual(previousVisibleGroupIdsRef.current, visibleGroupIds)) {
    previousVisibleGroupIdsRef.current = visibleGroupIds;
    dispatch({type: 'RECONCILE_VISIBLE_GROUP_IDS', groupIds: visibleGroupIds});
  }

  const reconcileVisibleGroupIds = useCallback((groupIds: string[]) => {
    dispatch({type: 'RECONCILE_VISIBLE_GROUP_IDS', groupIds});
  }, []);

  const toggleSelect = useCallback((groupId: string) => {
    dispatch({type: 'TOGGLE_SELECT', groupId});
  }, []);

  const shiftToggleSelect = useCallback(
    (groupId: string) => {
      dispatch({
        type: 'SHIFT_TOGGLE_SELECT',
        groupId,
        visibleGroupIds,
      });
    },
    [visibleGroupIds]
  );

  const toggleSelectAllVisible = useCallback(() => {
    dispatch({type: 'TOGGLE_SELECT_ALL_VISIBLE'});
  }, []);

  const deselectAll = useCallback(() => {
    dispatch({type: 'DESELECT_ALL'});
  }, []);

  const setAllInQuerySelected = useCallback((value: boolean) => {
    dispatch({type: 'SET_ALL_IN_QUERY_SELECTED', value});
  }, []);

  const selectedIdsSet = useMemo(
    () => new Set([...state.records.keys()].filter(id => state.records.get(id))),
    [state.records]
  );
  const anySelected = selectedIdsSet.size > 0;
  const multiSelected = selectedIdsSet.size > 1;
  const pageSelected = anySelected && selectedIdsSet.size === state.records.size;

  const summaryValue = useMemo<IssueSelectionSummary>(
    () => ({
      ...state,
      selectedIdsSet,
      anySelected,
      multiSelected,
      pageSelected,
    }),
    [state, selectedIdsSet, anySelected, multiSelected, pageSelected]
  );
  const actionsValue = useMemo<IssueSelectionActions>(
    () => ({
      toggleSelect,
      shiftToggleSelect,
      toggleSelectAllVisible,
      deselectAll,
      setAllInQuerySelected,
      reconcileVisibleGroupIds,
    }),
    [
      toggleSelect,
      shiftToggleSelect,
      toggleSelectAllVisible,
      deselectAll,
      setAllInQuerySelected,
      reconcileVisibleGroupIds,
    ]
  );

  return (
    <IssueSelectionActionsContext.Provider value={actionsValue}>
      <IssueSelectionSummaryContext.Provider value={summaryValue}>
        {children}
      </IssueSelectionSummaryContext.Provider>
    </IssueSelectionActionsContext.Provider>
  );
}

export function useIssueSelectionSummary() {
  const context = useContext(IssueSelectionSummaryContext);
  if (!context) {
    throw new Error(
      'useIssueSelectionSummary must be used inside IssueSelectionProvider'
    );
  }
  return context;
}

export function useIssueSelectionActions() {
  const context = useContext(IssueSelectionActionsContext);
  if (!context) {
    throw new Error(
      'useIssueSelectionActions must be used inside IssueSelectionProvider'
    );
  }
  return context;
}

export function useOptionalIssueSelectionSummary() {
  return useContext(IssueSelectionSummaryContext);
}

export function useOptionalIssueSelectionActions() {
  return useContext(IssueSelectionActionsContext);
}
