import {useCallback} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {ListState} from '@react-stately/list';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useKeyboardSelection} from 'sentry/components/searchQueryBuilder/hooks/useKeyboardSelection';
import {findNearestFreeTextKey} from 'sentry/components/searchQueryBuilder/utils';
import type {ParseResultToken} from 'sentry/components/searchSyntax/parser';
import {defined} from 'sentry/utils';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';

type SelectionKeyHandlerProps = {
  gridRef: React.RefObject<HTMLDivElement | null>;
  state: ListState<ParseResultToken>;
  undo: () => void;
  ref?: React.Ref<HTMLInputElement>;
};

/**
 * SelectionKeyHandler is used to handle keyboard events when a selection is
 * active, which differ from default behavior. When the user has a selection,
 * this component should be focused.
 *
 * We use an invisible input element in order to handle paste events. Without
 * this, the browser will need to ask for clipboard permissions.
 */
export function SelectionKeyHandler({
  ref,
  state,
  undo,
  gridRef,
}: SelectionKeyHandlerProps) {
  const {dispatch, disabled, currentInputValueRef} = useSearchQueryBuilder();
  const {selectInDirection} = useKeyboardSelection();

  const selectedTokens: ParseResultToken[] = [...state.collection.getKeys()]
    .filter(key => state.selectionManager.selectedKeys.has(key))
    .map(key => state.collection.getItem(key)?.value)
    .filter(defined);

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const text = e.clipboardData.getData('text/plain').replace('\n', '').trim();

      dispatch({
        type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
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
          e.preventDefault();
          e.stopPropagation();
          dispatch({
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_DELETE',
            tokens: selectedTokens,
            text: '',
          });
          state.selectionManager.setFocusedKey(
            findNearestFreeTextKey(state, state.selectionManager.firstSelectedKey, 'left')
          );
          state.selectionManager.clearSelection();

          // Ask Seer - Clear the input value when the user deletes all tokens
          if (state.collection.size === selectedTokens.length) {
            currentInputValueRef.current = '';
          }
          return;
        }
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();

          if (e.shiftKey) {
            selectInDirection({state, direction: 'right'});
            return;
          }

          state.selectionManager.clearSelection();
          state.selectionManager.setFocusedKey(
            findNearestFreeTextKey(state, state.selectionManager.lastSelectedKey, 'right')
          );
          return;
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();

          if (e.shiftKey) {
            selectInDirection({state, direction: 'left'});
            return;
          }

          state.selectionManager.clearSelection();
          state.selectionManager.setFocusedKey(
            findNearestFreeTextKey(state, state.selectionManager.firstSelectedKey, 'left')
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
                type: 'REPLACE_TOKENS_WITH_TEXT_ON_CUT',
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

          // Wrap selected tokens in parentheses when ( or ) is pressed
          if ((e.key === '(' || e.key === ')') && selectedTokens.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            dispatch({
              type: 'WRAP_TOKENS_WITH_PARENTHESES',
              tokens: selectedTokens,
            });
            state.selectionManager.clearSelection();
            return;
          }

          // If the key pressed will generate a symbol, replace the selection with it
          if (/^.$/u.test(e.key)) {
            dispatch({
              type: 'REPLACE_TOKENS_WITH_TEXT_ON_KEY_DOWN',
              text: e.key,
              tokens: selectedTokens,
            });
            state.selectionManager.clearSelection();
            e.preventDefault();
            e.stopPropagation();
          }

          return;
      }
    },
    [currentInputValueRef, dispatch, selectInDirection, selectedTokens, state, undo]
  );

  // Ensure that the selection is cleared when this input loses focus
  const onBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // React Aria will sometimes focus the grid element, which we handle in useQueryBuilderGrid().
      // This should be ignored since focus will return here.
      if (e.relatedTarget === gridRef.current) {
        return;
      }
      state.selectionManager.clearSelection();
    },
    [state.selectionManager, gridRef]
  );

  // Using VisuallyHidden because display: none will not allow the input to be focused
  return (
    <VisuallyHidden>
      <input
        data-test-id="selection-key-handler"
        ref={ref}
        tabIndex={-1}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        disabled={disabled}
        onBlur={onBlur}
      />
    </VisuallyHidden>
  );
}
