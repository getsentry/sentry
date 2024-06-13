import {type DOMAttributes, type FocusEvent, useCallback, useMemo} from 'react';
import {type AriaGridListOptions, useGridList} from '@react-aria/gridlist';
import {ListKeyboardDelegate} from '@react-aria/selection';
import type {ListState} from '@react-stately/list';
import {useListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useUndoStack} from 'sentry/components/searchQueryBuilder/useUndoStack';
import type {ParseResultToken} from 'sentry/components/searchSyntax/parser';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';

interface UseQueryBuilderGridProps extends AriaGridListOptions<ParseResultToken> {
  children: CollectionChildren<ParseResultToken>;
}

const noop = () => {};

/**
 * Modified version React Aria's useGridList to support the search component.
 *
 * See https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function useQueryBuilderGrid(
  props: UseQueryBuilderGridProps,
  ref: React.RefObject<HTMLDivElement>
): {
  gridProps: DOMAttributes<HTMLDivElement>;
  state: ListState<ParseResultToken>;
} {
  const {dispatch, query} = useSearchQueryBuilder();

  const state = useListState<ParseResultToken>({
    ...props,
    selectionBehavior: 'replace',
    onSelectionChange: selection => {
      // When there is a selection, set focus to the grid itself.
      if (selection === 'all' || selection.size > 0) {
        state.selectionManager.setFocusedKey(null);
        state.selectionManager.setFocused(true);
      }
    },
  });

  // The default behavior uses vertical naviation, but we want horizontal navigation
  const delegate = new ListKeyboardDelegate({
    collection: state.collection,
    disabledKeys: state.disabledKeys,
    ref,
    orientation: 'horizontal',
    direction: 'ltr',
  });

  const {gridProps: originalGridProps} = useGridList(
    {
      ...props,
      shouldFocusWrap: false,
      keyboardDelegate: delegate,
    },
    state,
    ref
  );

  const {undo} = useUndoStack(state);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'z' && isCtrlKeyPressed(e)) {
        undo();
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      // When there is a selection, the grid will have focus and handle that behavior.
      if (state.selectionManager.selectedKeys.size > 0) {
        switch (e.key) {
          case 'Backspace':
          case 'Delete':
            dispatch({type: 'CLEAR'});
            break;
          case 'c':
            if (isCtrlKeyPressed(e)) {
              navigator.clipboard.writeText(query);
            }
            break;
          case 'ArrowRight':
            state.selectionManager.setFocusedKey(state.collection.getLastKey());
            break;
          case 'ArrowLeft':
            state.selectionManager.setFocusedKey(state.collection.getFirstKey());
            break;
          default:
            break;
        }
      }

      if (e.target instanceof HTMLElement) {
        // If the focus is on a menu item, let that component handle the event
        if (e.target.getAttribute('role') === 'menuitemradio') {
          return;
        }
      }

      switch (e.key) {
        // Default behavior for these keys is to move the focus, which we don't want
        case 'ArrowUp':
        case 'ArrowDown':
          break;
        default:
          originalGridProps.onKeyDown?.(e);
      }
    },
    [dispatch, originalGridProps, query, state.collection, state.selectionManager, undo]
  );

  const gridProps = useMemo(
    () => ({
      ...originalGridProps,
      // If we click inside the grid but not on any of the items, focus the last one
      onClick: () => {
        state.selectionManager.setFocused(true);
        state.selectionManager.setFocusedKey(state.collection.getLastKey());
      },
      // The default behavior will capture some keys such as Enter and Space, which
      // we want to handle ourselves.
      onKeyDownCapture: noop,
      onKeyDown,
      onFocus: () => {
        if (state.selectionManager.isFocused) {
          return;
        }

        // Ensure that the state is updated correctly
        state.selectionManager.setFocused(true);

        // If nothing is has been focused yet , default to last item
        if (!state.selectionManager.focusedKey) {
          state.selectionManager.setFocusedKey(state.collection.getLastKey());
        }
      },
      onBlur: (e: FocusEvent) => {
        // Reset selection on any focus change, except when focus moves
        // to the grid itself (which is what happens when there is a selection)
        if (
          e.relatedTarget !== ref.current &&
          state.selectionManager.selectedKeys.size > 0
        ) {
          state.selectionManager.clearSelection();
        }
      },
    }),
    [onKeyDown, originalGridProps, ref, state.collection, state.selectionManager]
  );

  return {
    state,
    gridProps,
  };
}
