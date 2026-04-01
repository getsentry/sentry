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

interface UseArithmeticBuilderActionOptions {
  initialExpression: string;
  references?: Set<string>;
  updateExpression?: (expression: Expression) => void;
}

export function useArithmeticBuilderAction({
  initialExpression,
  references,
  updateExpression,
}: UseArithmeticBuilderActionOptions): {
  dispatch: (action: ArithmeticBuilderAction) => void;
  state: {
    expression: Expression;
    focusOverride: FocusOverride | null;
  };
} {
  const [expressionString, setExpressionString] = useState(initialExpression);
  const [focusOverride, setFocusOverride] = useState<FocusOverride | null>(null);

  // Recreate the Expression when the string or references change because
  // a reference change may invalidate some of the current references and turn
  // them into free text tokens.
  const expression = useMemo(
    () => new Expression(expressionString, references),
    [expressionString, references]
  );

  const dispatch = useCallback(
    (action: ArithmeticBuilderAction) => {
      if (isArithmeticBuilderUpdateResetFocusOverrideAction(action)) {
        setFocusOverride(null);
      } else if (isArithmeticBuilderDeleteAction(action)) {
        const newText = deleteTokenText(expressionString, action);
        setExpressionString(newText);
        updateExpression?.(new Expression(newText, references));
        if (defined(action.focusOverride)) {
          setFocusOverride(action.focusOverride);
        }
      } else if (isArithmeticBuilderReplaceAction(action)) {
        const newText = replaceTokenText(expressionString, action);
        setExpressionString(newText);
        updateExpression?.(new Expression(newText, references));
        if (defined(action.focusOverride)) {
          setFocusOverride(action.focusOverride);
        }
      }
    },
    [expressionString, references, updateExpression]
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

function deleteTokenText(text: string, action: ArithmeticBuilderDeleteAction): string {
  const [head, tail] = queryHeadTail(text, action.token);
  return removeExcessWhitespaceFromParts(head, tail);
}

function replaceTokenText(text: string, action: ArithmeticBuilderReplaceAction): string {
  const [head, tail] = queryHeadTail(text, action.token);
  return removeExcessWhitespaceFromParts(head, action.text, tail);
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
