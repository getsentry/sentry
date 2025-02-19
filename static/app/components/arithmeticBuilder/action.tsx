import {useCallback, useMemo, useState} from 'react';
import type {Key} from '@react-types/shared';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
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
  expression: string;
  focusOverride: FocusOverride | null;
  tokens: Token[];
  validated: 'valid' | 'invalid';
}

interface UseArithmeticBuilderActionOptions {
  initialExpression: string;
  updateExpression?: (expression: string) => void;
}

export function useArithmeticBuilderAction({
  initialExpression,
  updateExpression,
}: UseArithmeticBuilderActionOptions): {
  dispatch: (action: ArithmeticBuilderAction) => void;
  state: {
    expression: Expression;
    focusOverride: FocusOverride | null;
  };
} {
  const [expression, setExpression] = useState(() => new Expression(initialExpression));
  const [focusOverride, setFocusOverride] = useState<FocusOverride | null>(null);

  const dispatch = useCallback(
    (action: ArithmeticBuilderAction) => {
      if (isArithmeticBuilderUpdateResetFocusOverrideAction(action)) {
        setFocusOverride(null);
      } else if (isArithmeticBuilderDeleteAction(action)) {
        const newExpression = deleteToken(expression.text, action);
        if (newExpression.valid === 'valid') {
          updateExpression?.(newExpression.text);
        }
        setExpression(newExpression);
        if (defined(action.focusOverride)) {
          setFocusOverride(action.focusOverride);
        }
      } else if (isArithmeticBuilderReplaceAction(action)) {
        const newExpression = replaceToken(expression.text, action);
        if (newExpression.valid === 'valid') {
          updateExpression?.(newExpression.text);
        }
        setExpression(newExpression);
        if (defined(action.focusOverride)) {
          setFocusOverride(action.focusOverride);
        }
      }
    },
    [expression.text, updateExpression]
  );

  const state = useMemo(
    () => ({
      expression,
      focusOverride,
    }),
    [expression, focusOverride]
  );

  return {state, dispatch};
}

function deleteToken(text: string, action: ArithmeticBuilderDeleteAction) {
  const [head, tail] = queryHeadTail(text, action.token);
  return new Expression(removeExcessWhitespaceFromParts(head, tail));
}

function replaceToken(text: string, action: ArithmeticBuilderReplaceAction) {
  const [head, tail] = queryHeadTail(text, action.token);
  return new Expression(removeExcessWhitespaceFromParts(head, action.text, tail));
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
