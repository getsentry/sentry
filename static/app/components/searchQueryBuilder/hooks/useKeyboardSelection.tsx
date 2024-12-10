import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import type {ListState} from '@react-stately/list';
import type {Key} from '@react-types/shared';

import {findNearestFreeTextKey} from 'sentry/components/searchQueryBuilder/utils';
import {type ParseResultToken, Token} from 'sentry/components/searchSyntax/parser';

type SelectFunc = (params: {
  direction: 'left' | 'right';
  state: ListState<ParseResultToken>;
  beginNewSelectionFromKey?: Key;
  toEnd?: boolean;
}) => void;

export interface KeyboardSelectionData {
  selectInDirection: SelectFunc;
}

export function useKeyboardSelection() {
  return useContext(KeyboardSelectionContext);
}

function getKeysBetween(state: ListState<ParseResultToken>, key1: Key, key2: Key) {
  const keys = [...state.collection.getKeys()];

  const keyIndex1 = keys.indexOf(key1);
  const keyIndex2 = keys.indexOf(key2);

  if (keyIndex1 < keyIndex2) {
    return keys.slice(keyIndex1, keyIndex2 + 1);
  }

  return keys.slice(keyIndex2, keyIndex1 + 1);
}

function combineSelection(state: ListState<ParseResultToken>, newSelection: Key[]) {
  const currentSelection = new Set(state.selectionManager.selectedKeys);

  for (const key of newSelection) {
    if (currentSelection.has(key)) {
      currentSelection.delete(key);
    } else {
      currentSelection.add(key);
    }
  }

  return currentSelection;
}

function useKeyboardSelectionState() {
  const cursorKeyPositionRef = useRef<Key | null>();

  const selectInDirection = useCallback<SelectFunc>(
    ({state, beginNewSelectionFromKey, direction}) => {
      const fromKey =
        beginNewSelectionFromKey ??
        cursorKeyPositionRef.current ??
        (direction === 'left'
          ? state.selectionManager.firstSelectedKey
          : state.selectionManager.lastSelectedKey);

      if (!fromKey) {
        return;
      }

      // Get the start key to make the new selection from.
      // If we are alre
      const nextKeyInDirection =
        direction === 'left'
          ? state.collection.getKeyBefore(fromKey)
          : state.collection.getKeyAfter(fromKey);
      const fromItem = state.collection.getItem(fromKey);
      const startKey =
        fromItem?.value?.type === Token.FREE_TEXT ? nextKeyInDirection : fromKey;

      if (!startKey) {
        return;
      }

      const endKey = findNearestFreeTextKey(state, startKey, direction);

      if (!endKey) {
        return;
      }

      const newSelection = getKeysBetween(state, startKey, endKey);

      state.selectionManager.setSelectedKeys(combineSelection(state, newSelection));
      cursorKeyPositionRef.current = endKey;
    },
    []
  );

  return useMemo(
    () => ({
      selectInDirection,
    }),
    [selectInDirection]
  );
}

const KeyboardSelectionContext = createContext<KeyboardSelectionData>({
  selectInDirection: () => {},
});

/**
 * Keyboard selection requires some additional state - the cursor position.
 * Focus is lost when a selection is enabled, so this context is necessary
 * to keep track of the latest cursor position.
 */
export function KeyboardSelection({children}: {children: ReactNode}) {
  const state = useKeyboardSelectionState();

  return (
    <KeyboardSelectionContext.Provider value={state}>
      {children}
    </KeyboardSelectionContext.Provider>
  );
}
