import type {FocusEvent, RefObject} from 'react';
import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';
import type {ListState} from '@react-stately/list';
import type {KeyboardEvent, Node} from '@react-types/shared';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import {
  TokenKind,
  type Token,
  type TokenAttribute,
  type TokenFunction,
} from 'sentry/components/arithmeticBuilder/token';
import {nextTokenKeyOfKind} from 'sentry/components/arithmeticBuilder/tokenizer';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {focusTarget} from 'sentry/components/tokenizedInput/grid/utils';
import {defined} from 'sentry/utils/defined';

type FunctionArgumentValue = {label: string; value: string};

export interface FunctionArgumentInputProps {
  argument: FunctionArgumentValue;
  argumentIndex: number;
  argumentItem: Node<TokenAttribute>;
  argumentRef: RefObject<HTMLDivElement | null>;
  arguments: FunctionArgumentValue[];
  argumentsListState: ListState<TokenAttribute>;
  functionItem: Node<Token>;
  functionListState: ListState<Token>;
  functionToken: TokenFunction;
  onArgumentsBlur: () => void;
  onArgumentsChange: (index: number, argument: string) => void;
  rowRef: RefObject<HTMLDivElement | null>;
}

export function useFunctionArgumentInput({
  argumentIndex,
  argumentItem,
  argumentRef,
  arguments: functionArguments,
  argumentsListState,
  functionItem,
  functionListState,
  functionToken,
  onArgumentsBlur,
}: FunctionArgumentInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gridCellRef = useRef<HTMLDivElement>(null);
  const skipBlurFlushRef = useRef(false);
  const {rowProps, gridCellProps} = useGridListItem({
    item: argumentItem,
    ref: gridCellRef,
    state: argumentsListState,
    focusable: true,
  });

  const isFocused = argumentItem.key === argumentsListState.selectionManager.focusedKey;
  const hasNextArgument = argumentIndex < functionToken.attributes.length - 1;
  const hasPrevArgument = argumentIndex > 0;
  const {dispatch} = useArithmeticBuilder();

  const shouldCloseOnInteractOutside = useCallback((el: Element) => {
    return !gridCellRef.current?.contains(el);
  }, []);

  const updateAttrsWith = useCallback(
    (value: string) => {
      const tokenArguments = functionArguments.map(arg => arg.value);
      tokenArguments[argumentIndex] = value;
      return tokenArguments.join(',');
    },
    [argumentIndex, functionArguments]
  );

  const clearSkipBlurFlush = useCallback(() => {
    skipBlurFlushRef.current = false;
  }, []);

  const flushArgumentsIfLeavingGrid = useCallback(
    (evt?: FocusEvent<HTMLInputElement>) => {
      // Stay skipped until the next focus: a later interact-outside `onInputBlur()`
      // timeout would otherwise restore the token after DELETE/REPLACE.
      if (skipBlurFlushRef.current) {
        return;
      }

      if (!evt) {
        window.setTimeout(() => {
          if (skipBlurFlushRef.current) {
            return;
          }
          const stayingInArgs = Boolean(
            document.activeElement &&
            argumentRef.current?.contains(document.activeElement)
          );
          if (!stayingInArgs) {
            onArgumentsBlur();
          }
        }, 0);
        return;
      }

      const argsGrid = evt.currentTarget.closest('[role="grid"]');
      const related = evt.relatedTarget;
      const stayingInArgs = Boolean(
        argsGrid && related instanceof globalThis.Node && argsGrid.contains(related)
      );
      if (!stayingInArgs) {
        onArgumentsBlur();
      }
    },
    [argumentRef, onArgumentsBlur]
  );

  const onKeyDownCapture = useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      // At start and pressing left arrow, focus the previous full token
      if (
        evt.currentTarget.selectionStart === 0 &&
        evt.currentTarget.selectionEnd === 0 &&
        evt.key === 'ArrowLeft'
      ) {
        if (hasPrevArgument) {
          focusTarget(
            argumentsListState,
            argumentsListState.collection.getKeyBefore(argumentItem.key)
          );
        } else {
          focusTarget(
            functionListState,
            functionListState.collection.getKeyBefore(functionItem.key)
          );
        }
        return;
      }

      // At end and pressing right arrow, focus the next full token
      if (
        evt.currentTarget.selectionStart === evt.currentTarget.value.length &&
        evt.currentTarget.selectionEnd === evt.currentTarget.value.length &&
        evt.key === 'ArrowRight'
      ) {
        if (hasNextArgument) {
          focusTarget(
            argumentsListState,
            argumentsListState.collection.getKeyAfter(argumentItem.key)
          );
        } else {
          focusTarget(
            functionListState,
            functionListState.collection.getKeyAfter(functionItem.key)
          );
        }
      }
    },
    [
      hasPrevArgument,
      argumentsListState,
      argumentItem.key,
      functionListState,
      functionItem.key,
      hasNextArgument,
    ]
  );

  const onKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      const selectionStart = evt.currentTarget.selectionStart ?? 0;
      const selectionEnd = evt.currentTarget.selectionEnd ?? 0;
      const valueLength = evt.currentTarget.value.length;
      const isCollapsedAtStart = selectionStart === 0 && selectionEnd === 0;
      const isCollapsedAtEnd =
        selectionStart === valueLength && selectionEnd === valueLength;

      // Collapsed caret at start + Backspace deletes the function. A full
      // selection must not — filter/value args keep their text on focus, so
      // select-all then Backspace should edit the argument.
      if (evt.key === 'Backspace' && isCollapsedAtStart) {
        evt.preventDefault();
        skipBlurFlushRef.current = true;
        const itemKey = functionListState.collection.getKeyBefore(functionItem.key);
        dispatch({
          type: 'DELETE_TOKEN',
          token: functionToken,
          focusOverride: defined(itemKey) ? {itemKey} : undefined,
        });
        return;
      }

      // Collapsed caret at end + Delete deletes the function.
      if (evt.key === 'Delete' && isCollapsedAtEnd) {
        evt.preventDefault();
        skipBlurFlushRef.current = true;
        const itemKey = functionListState.collection.getKeyBefore(functionItem.key);
        dispatch({
          type: 'DELETE_TOKEN',
          token: functionToken,
          focusOverride: defined(itemKey) ? {itemKey} : undefined,
        });
      }
    },
    [dispatch, functionToken, functionListState, functionItem]
  );

  const dataTestId =
    functionListState.collection.getLastKey() === functionItem.key
      ? 'arithmetic-builder-argument-input'
      : undefined;

  const focusArgument = useCallback(() => {
    focusTarget(argumentsListState, argumentItem.key);
  }, [argumentItem.key, argumentsListState]);

  const focusNextArgument = useCallback(() => {
    focusTarget(
      argumentsListState,
      argumentsListState.collection.getKeyAfter(argumentItem.key)
    );
  }, [argumentItem.key, argumentsListState]);

  const commitFunctionToken = useCallback(
    (value: string) => {
      skipBlurFlushRef.current = true;
      dispatch({
        text: `${functionToken.function}(${updateAttrsWith(value)})`,
        type: 'REPLACE_TOKEN',
        token: functionToken,
        focusOverride: {
          itemKey: nextTokenKeyOfKind(
            functionListState,
            functionToken,
            TokenKind.FREE_TEXT
          ),
        },
      });
    },
    [dispatch, functionListState, functionToken, updateAttrsWith]
  );

  return {
    clearSkipBlurFlush,
    commitFunctionToken,
    dataTestId,
    flushArgumentsIfLeavingGrid,
    focusArgument,
    focusNextArgument,
    gridCellProps,
    gridCellRef,
    hasNextArgument,
    inputRef,
    isFocused,
    onKeyDown,
    onKeyDownCapture,
    rowProps,
    shouldCloseOnInteractOutside,
  };
}

export const ArgumentGridRow = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  height: 100%;
  flex: 0 1 auto;
  max-width: fit-content;
`;

export const ArgumentGridCell = styled('div')`
  display: flex;
  align-items: center;
  height: 100%;

  > div input {
    max-width: 130px !important;
    min-width: 0 !important;
    white-space: nowrap !important;
  }

  /* The expandable equation/filter field sets data-expanded while focused. Lift
     the cap so long arguments are fully readable; stay truncated when collapsed. */
  [data-expanded='true'] & > div input {
    max-width: none !important;
  }
`;
