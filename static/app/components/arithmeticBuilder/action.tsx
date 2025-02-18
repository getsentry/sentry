import type {Reducer} from 'react';
import {useCallback, useReducer} from 'react';
import type {Key} from '@react-types/shared';

import type {Token} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {validateTokens} from 'sentry/components/arithmeticBuilder/validator';
import {defined} from 'sentry/utils';

type ArithmeticBuilderUpdateResetFocusOverrideAction = {
  type: 'RESET_FOCUS_OVERRIDE';
};

export type FocusOverride = {
  itemKey: Key;
};

type ArithmeticBuilderDeleteAction = {
  token: Token;
  type: 'DELETE_TOKEN';
  focusOverride?: FocusOverride;
};

type ArithmeticBuilderReplaceAction = {
  text: string;
  token: Token;
  type: 'REPLACE_TOKEN';
  focusOverride?: FocusOverride;
};

export type ArithmeticBuilderAction =
  | ArithmeticBuilderUpdateResetFocusOverrideAction
  | ArithmeticBuilderDeleteAction
  | ArithmeticBuilderReplaceAction;

function isArithmeticBuilderUpdateResetFocusOverrideAction(
  action: ArithmeticBuilderAction
): action is ArithmeticBuilderUpdateResetFocusOverrideAction {
  return action.type === 'RESET_FOCUS_OVERRIDE';
}

function isArithmeticBuilderDeleteAction(
  action: ArithmeticBuilderAction
): action is ArithmeticBuilderDeleteAction {
  return action.type === 'DELETE_TOKEN';
}

function isArithmeticBuilderReplaceAction(
  action: ArithmeticBuilderAction
): action is ArithmeticBuilderReplaceAction {
  return action.type === 'REPLACE_TOKEN';
}

export interface ArithmeticBuilderState {
  expression: string;
  focusOverride: FocusOverride | null;
  tokens: Token[];
  validated: 'valid' | 'invalid';
}

interface UseArithmeticBuilderActionOptions {
  initialExpression: string;
  setExpression?: (expression: string) => void;
}

export function useArithmeticBuilderAction({
  initialExpression,
  setExpression,
}: UseArithmeticBuilderActionOptions) {
  const reducer: Reducer<ArithmeticBuilderState, ArithmeticBuilderAction> = useCallback(
    (state, action): ArithmeticBuilderState => {
      const newState = handleAction(state, action);

      if (state.expression !== newState.expression) {
        newState.tokens = tokenizeExpression(newState.expression);
        newState.validated = validateTokens(newState.tokens)
          ? ('valid' as const)
          : ('invalid' as const);
        // when the expression changes and is valid, propogate the update
        if (newState.validated === 'valid') {
          setExpression?.(newState.expression);
        }
      }

      return newState;
    },
    [setExpression]
  );

  const [state, dispatch] = useReducer(
    reducer,
    {
      expression: initialExpression,
      focusOverride: null,
      tokens: [],
      validated: 'invalid',
    },
    (initialState: ArithmeticBuilderState): ArithmeticBuilderState => {
      const tokens = tokenizeExpression(initialState.expression);
      const validated = validateTokens(tokens)
        ? ('valid' as const)
        : ('invalid' as const);
      return {
        ...initialState,
        tokens,
        validated,
      };
    }
  );

  return {state, dispatch};
}

function handleAction(
  state: ArithmeticBuilderState,
  action: ArithmeticBuilderAction
): ArithmeticBuilderState {
  if (isArithmeticBuilderUpdateResetFocusOverrideAction(action)) {
    return resetFocusOverride(state);
  }

  if (isArithmeticBuilderDeleteAction(action)) {
    return deleteToken(state, action);
  }

  if (isArithmeticBuilderReplaceAction(action)) {
    return replaceToken(state, action);
  }

  return state;
}

function resetFocusOverride(state: ArithmeticBuilderState) {
  return {
    ...state,
    focusOverride: null,
  };
}

function deleteToken(
  state: ArithmeticBuilderState,
  action: ArithmeticBuilderDeleteAction
): ArithmeticBuilderState {
  const [head, tail] = queryHeadTail(state.expression, action.token);
  const expression = removeExcessWhitespaceFromParts(head, tail);
  return {
    ...state,
    expression,
    focusOverride: defined(action.focusOverride)
      ? action.focusOverride
      : state.focusOverride,
  };
}

function replaceToken(
  state: ArithmeticBuilderState,
  action: ArithmeticBuilderReplaceAction
): ArithmeticBuilderState {
  const [head, tail] = queryHeadTail(state.expression, action.token);
  const expression = removeExcessWhitespaceFromParts(head, action.text, tail);
  return {
    ...state,
    expression,
    focusOverride: defined(action.focusOverride)
      ? action.focusOverride
      : state.focusOverride,
  };
}

function queryHeadTail(expression: string, token: Token): [string, string] {
  const head = expression.substring(0, token.location.start.offset);
  const tail = expression.substring(token.location.end.offset);
  return [head, tail];
}

function removeExcessWhitespaceFromParts(...parts: string[]): string {
  return parts
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(' ')
    .trim();
}
