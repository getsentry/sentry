import type {Reducer} from 'react';
import {useCallback, useReducer} from 'react';
import type {Key} from '@react-types/shared';

import type {Token} from 'sentry/components/arithmeticBuilder/token';
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
  focusOverride: FocusOverride | null;
  query: string;
}

interface UseArithmeticBuilderActionOptions {
  initialQuery: string;
}

export function useArithmeticBuilderAction({
  initialQuery,
}: UseArithmeticBuilderActionOptions) {
  const reducer: Reducer<ArithmeticBuilderState, ArithmeticBuilderAction> = useCallback(
    (state, action): ArithmeticBuilderState => {
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
    },
    []
  );

  const [state, dispatch] = useReducer(reducer, {
    query: initialQuery,
    focusOverride: null,
  });

  return {state, dispatch};
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
  const [head, tail] = queryHeadTail(state.query, action.token);
  const query = removeExcessWhitespaceFromParts(head, tail);
  return {
    ...state,
    query,
    focusOverride: defined(action.focusOverride)
      ? action.focusOverride
      : state.focusOverride,
  };
}

function replaceToken(
  state: ArithmeticBuilderState,
  action: ArithmeticBuilderReplaceAction
): ArithmeticBuilderState {
  const [head, tail] = queryHeadTail(state.query, action.token);
  const query = removeExcessWhitespaceFromParts(head, action.text, tail);
  return {
    ...state,
    query,
    focusOverride: defined(action.focusOverride)
      ? action.focusOverride
      : state.focusOverride,
  };
}

function queryHeadTail(query: string, token: Token): [string, string] {
  const head = query.substring(0, token.location.start.offset);
  const tail = query.substring(token.location.end.offset);
  return [head, tail];
}

function removeExcessWhitespaceFromParts(...parts: string[]): string {
  return parts
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(' ')
    .trim();
}
