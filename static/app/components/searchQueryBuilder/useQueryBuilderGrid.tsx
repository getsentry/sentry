import {type DOMAttributes, type FocusEvent, useCallback, useMemo} from 'react';
import {type AriaGridListOptions, useGridList} from '@react-aria/gridlist';
import {ListKeyboardDelegate} from '@react-aria/selection';
import type {ListState} from '@react-stately/list';
import {useListState} from '@react-stately/list';
import type {CollectionChildren, Key} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useUndoStack} from 'sentry/components/searchQueryBuilder/useUndoStack';
import {type ParseResultToken, Token} from 'sentry/components/searchSyntax/parser';
import {defined} from 'sentry/utils';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';

interface UseQueryBuilderGridProps extends AriaGridListOptions<ParseResultToken> {
  children: CollectionChildren<ParseResultToken>;
}

const noop = () => {};

function findNearestFreeTextKey(
  state: ListState<ParseResultToken>,
  startKey: Key | null,
  direction: 'right' | 'left'
): Key | null {
  let key: Key | null = startKey;
  while (key) {
    const item = state.collection.getItem(key);
    if (!item) {
      break;
    }
    if (item.value?.type === Token.FREE_TEXT) {
      return key;
    }
    key = (direction === 'right' ? item.nextKey : item.prevKey) ?? null;
  }

  if (key) {
    return key;
  }

  return direction === 'right'
    ? state.collection.getLastKey()
    : state.collection.getFirstKey();
}

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
  const {dispatch} = useSearchQueryBuilder();

  const state = useListState<ParseResultToken>({
    ...props,
    selectionBehavior: 'replace',
    onSelectionChange: selection => {
      // When there is a selection, set focus to the grid itself.
      if (selection === 'all' || selection.size > 0) {
        ref.current?.focus();
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
    async (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'z' && isCtrlKeyPressed(e)) {
        undo();
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      // When there is a selection, the grid will have focus and handle that behavior.
      if (state.selectionManager.selectedKeys.size > 0) {
        const selectedTokens = Array.from(state.selectionManager.selectedKeys)
          .map(key => state.collection.getItem(key)?.value)
          .filter(defined);

        switch (e.key) {
          case 'Backspace':
          case 'Delete': {
            dispatch({
              type: 'REPLACE_TOKENS_WITH_TEXT',
              tokens: selectedTokens,
              text: '',
            });
            state.selectionManager.setFocusedKey(
              findNearestFreeTextKey(
                state,
                state.selectionManager.firstSelectedKey,
                'left'
              )
            );
            state.selectionManager.clearSelection();
            return;
          }
          case 'ArrowRight':
            state.selectionManager.clearSelection();
            state.selectionManager.setFocusedKey(
              findNearestFreeTextKey(
                state,
                state.selectionManager.lastSelectedKey,
                'right'
              )
            );
            return;
          case 'ArrowLeft':
            state.selectionManager.clearSelection();
            state.selectionManager.setFocusedKey(
              findNearestFreeTextKey(
                state,
                state.selectionManager.firstSelectedKey,
                'left'
              )
            );
            return;
          default:
            if (isCtrlKeyPressed(e)) {
              const copySelectedTokens = () => {
                const queryToCopy = selectedTokens
                  .map(token => token.text)
                  .join('')
                  .trim();
                navigator.clipboard.writeText(queryToCopy);
              };

              if (e.key === 'a') {
                state.selectionManager.selectAll();
                e.preventDefault();
                e.stopPropagation();
              } else if (e.key === 'z') {
                state.selectionManager.clearSelection();
                undo();
                e.stopPropagation();
                e.preventDefault();
              } else if (e.key === 'x') {
                state.selectionManager.clearSelection();
                copySelectedTokens();
                dispatch({
                  type: 'REPLACE_TOKENS_WITH_TEXT',
                  tokens: selectedTokens,
                  text: '',
                });
                e.stopPropagation();
                e.preventDefault();
              } else if (e.key === 'v') {
                state.selectionManager.clearSelection();

                // TODO(malwilley): Find a way to handle pasting without requiring user permissions
                const text = await navigator.clipboard.readText();
                const cleanedText = text.replace('\n', '').trim();
                dispatch({
                  type: 'REPLACE_TOKENS_WITH_TEXT',
                  tokens: selectedTokens,
                  text: cleanedText,
                });
                e.preventDefault();
                e.stopPropagation();
              } else if (e.key === 'c') {
                copySelectedTokens();
                e.preventDefault();
                e.stopPropagation();
              }
              return;
            }

            // If th key pressed will generate a symbol, replace the selection with it
            if (/^.$/u.test(e.key)) {
              dispatch({
                type: 'REPLACE_TOKENS_WITH_TEXT',
                text: e.key,
                tokens: selectedTokens,
              });
              e.preventDefault();
              e.stopPropagation();
            }

            return;
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
    [dispatch, originalGridProps, state, undo]
  );

  const gridProps = useMemo(
    () => ({
      ...originalGridProps,
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
