import {type DOMAttributes, type FocusEvent, useCallback, useMemo} from 'react';
import {type AriaGridListOptions, useGridList} from '@react-aria/gridlist';
import {ListKeyboardDelegate} from '@react-aria/selection';
import type {ListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

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
export function useQueryBuilderGrid({
  props,
  state,
  ref,
  selectionKeyHandlerRef,
  undo,
}: {
  props: UseQueryBuilderGridProps;
  ref: React.RefObject<HTMLDivElement>;
  selectionKeyHandlerRef: React.RefObject<HTMLInputElement>;
  state: ListState<ParseResultToken>;
  undo: () => void;
}): {
  gridProps: DOMAttributes<HTMLDivElement>;
} {
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

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'z' && isCtrlKeyPressed(e)) {
        undo();
        e.stopPropagation();
        e.preventDefault();
        return;
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
    [originalGridProps, undo]
  );

  const gridProps = useMemo(
    () => ({
      ...originalGridProps,
      // The default behavior will capture some keys such as Enter and Space, which
      // we want to handle ourselves.
      onKeyDownCapture: noop,
      onKeyDown,
      onFocus: (e: FocusEvent) => {
        // This element should never take focus from the SelectionKeyHandler
        if (
          e.target === ref.current &&
          e.relatedTarget === selectionKeyHandlerRef.current
        ) {
          selectionKeyHandlerRef.current?.focus();
          return;
        }

        if (state.selectionManager.isFocused) {
          return;
        }

        // Ensure that the state is updated correctly
        state.selectionManager.setFocused(true);

        // If nothing is has been focused yet, default to last item
        if (!state.selectionManager.focusedKey) {
          state.selectionManager.setFocusedKey(state.collection.getLastKey());
        }
      },
      onBlur: (e: FocusEvent) => {
        const nextFocusedElement = e.relatedTarget;

        // If we're leaving the grid, update the focused state
        if (!ref.current?.contains(nextFocusedElement)) {
          state.selectionManager.setFocused(false);
        }

        // Reset selection on any focus change, except when focus moves to the
        // SelectionKeyHandler (which is what happens when there is a selection).
        if (
          nextFocusedElement !== ref.current &&
          nextFocusedElement !== selectionKeyHandlerRef.current &&
          state.selectionManager.selectedKeys.size > 0
        ) {
          state.selectionManager.clearSelection();
        }
      },
    }),
    [
      onKeyDown,
      originalGridProps,
      ref,
      selectionKeyHandlerRef,
      state.collection,
      state.selectionManager,
    ]
  );

  return {gridProps};
}
