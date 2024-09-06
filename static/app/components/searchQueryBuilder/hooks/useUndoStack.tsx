import {useCallback, useRef} from 'react';
import type {ListState} from '@react-stately/list';
import type {Key} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {FocusOverride} from 'sentry/components/searchQueryBuilder/types';
import type {ParseResultToken} from 'sentry/components/searchSyntax/parser';
import {defined} from 'sentry/utils';

type UndoItem = {
  /**
   * If there was a focus override when the query was saved, it should be
   * restored when undoing if available. Otherwise, the last focused key
   * should be used.
   */
  focusOverride: FocusOverride | null | undefined;
  /**
   * The last focused key when the query was shown.
   */
  focusedKey: Key | null;
  /**
   * The raw query string. No two sequential items should have the same query.
   */
  query: string;
};

const MAX_ITEMS = 100;

function getPreviousUndoItem(undoStack: UndoItem[], query: string) {
  while (undoStack.length > 0) {
    const undoItem = undoStack.at(-1);
    if (undoItem?.query !== query) {
      return undoItem;
    }
    // Prevent last item from being removed
    if (undoStack.length === 1) {
      return undefined;
    }
    undoStack.pop();
  }

  return undefined;
}

function updateUndoStack({
  undoStack,
  query,
  focusOverride,
  state,
}: {
  focusOverride: FocusOverride | null;
  query: string;
  state: ListState<ParseResultToken>;
  undoStack: UndoItem[];
}) {
  const lastQuery = undoStack.at(-1)?.query;

  if (lastQuery !== query) {
    undoStack.push({
      query,
      focusOverride,
      focusedKey: state.selectionManager.focusedKey ?? state.collection.getLastKey(),
    });
  } else if (
    undoStack.length > 0 &&
    state.selectionManager.focusedKey !== undoStack.at(-1)?.focusedKey
  ) {
    undoStack.at(-1)!.focusedKey = state.selectionManager.focusedKey;
  }

  if (undoStack.length > MAX_ITEMS) {
    undoStack.splice(0, undoStack.length - MAX_ITEMS);
  }
}

/**
 * Hook that manages the undo stack for the search query builder.
 */
export function useUndoStack(state: ListState<ParseResultToken>) {
  const {query, focusOverride, dispatch} = useSearchQueryBuilder();
  const undoStackRef = useRef<UndoItem[]>([]);
  const trimmedQuery = query.trim();

  updateUndoStack({
    undoStack: undoStackRef.current,
    query: trimmedQuery,
    focusOverride,
    state,
  });

  const undo = useCallback(() => {
    const previousItem = getPreviousUndoItem(undoStackRef.current, trimmedQuery);

    if (defined(previousItem) && previousItem.query !== trimmedQuery) {
      const newFocusOverride: FocusOverride | null | undefined =
        previousItem.focusOverride ??
        (previousItem.focusedKey
          ? {itemKey: previousItem.focusedKey.toString()}
          : undefined);
      dispatch({
        type: 'UPDATE_QUERY',
        query: previousItem.query,
        focusOverride: newFocusOverride,
      });
    }
  }, [dispatch, trimmedQuery]);

  return {
    undoStack: undoStackRef.current,
    undo,
  };
}
