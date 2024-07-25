import {type ForwardedRef, forwardRef, useCallback} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {ListState} from '@react-stately/list';
import type {Key} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {type ParseResultToken, Token} from 'sentry/components/searchSyntax/parser';
import {defined} from 'sentry/utils';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';

type SelectionKeyHandlerProps = {
  state: ListState<ParseResultToken>;
  undo: () => void;
};

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
 * SelectionKeyHandler is used to handle keyboard events when a selection is
 * active, which differ from default behavior. When the user has a selection,
 * this component should be focused.
 *
 * We use an invisible input element in order to handle paste events. Without
 * this, the browser will need to ask for clipboard permissions.
 */
export const SelectionKeyHandler = forwardRef(
  ({state, undo}: SelectionKeyHandlerProps, ref: ForwardedRef<HTMLInputElement>) => {
    const {dispatch, disabled} = useSearchQueryBuilder();

    const selectedTokens = Array.from(state.selectionManager.selectedKeys)
      .map(key => state.collection.getItem(key)?.value)
      .filter(defined);

    const onPaste = useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const text = e.clipboardData.getData('text/plain').replace('\n', '').trim();

        dispatch({
          type: 'REPLACE_TOKENS_WITH_TEXT',
          tokens: selectedTokens,
          text,
        });
      },
      [dispatch, selectedTokens]
    );

    const onKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
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
      },
      [dispatch, selectedTokens, state, undo]
    );

    // Using VisuallyHidden because display: none will not allow the input to be focused
    return (
      <VisuallyHidden>
        <input
          aria-hidden
          data-test-id="selection-key-handler"
          ref={ref}
          tabIndex={-1}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
      </VisuallyHidden>
    );
  }
);
