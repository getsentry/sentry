import {useCallback, useEffect, useMemo, useTransition} from 'react';
import isEqual from 'lodash/isEqual';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {
  isTokenFreeText,
  isTokenReference,
} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {usePrevious} from 'sentry/utils/usePrevious';

function unresolveExpression(
  expression: string,
  referenceMap: Record<string, string> = {}
): string {
  // Reverse the keys and values of the reference map, duplicates keep the first reference found
  const reversedReferenceMap = Object.fromEntries(
    Object.entries(referenceMap).map(([key, value]) => [value, key])
  );

  const tokens = tokenizeExpression(expression);
  return tokens
    .map(token => {
      if (token.text in reversedReferenceMap) {
        return reversedReferenceMap[token.text] ?? token.text;
      }
      return token.text;
    })
    .join(' ');
}

function resolveExpression(
  expression: Expression,
  referenceMap: Record<string, string> = {}
): Expression {
  const newTokens = expression.tokens
    .map(token => {
      if (referenceMap && isTokenReference(token) && token.text in referenceMap) {
        return referenceMap[token.text];
      }
      if (!isTokenFreeText(token)) {
        return token.text;
      }
      return null;
    })
    .filter(Boolean);

  return new Expression(newTokens.join(' '));
}

/**
 * A component that takes an equation in full resolved form and allows
 * the user to edit it using "references" to refer to the different components
 * of the equation.
 *
 * The references are used to resolve the equation into a format that is
 * compatible with our querying endpoints.
 */
export function EquationBuilder({
  expression,
  referenceMap,
  handleExpressionChange,
}: {
  expression: string;
  handleExpressionChange: (expression: Expression) => void;
  referenceMap?: Record<string, string>;
}) {
  const [_, startTransition] = useTransition();
  const prevReferenceMap = usePrevious(referenceMap);
  const references = useMemo(
    () => new Set(Object.keys(referenceMap ?? {})),
    [referenceMap]
  );
  const internalExpression = unresolveExpression(expression, referenceMap);

  const handleInternalExpressionChange = useCallback(
    (newExpression: Expression) => {
      startTransition(() => {
        handleExpressionChange(resolveExpression(newExpression, referenceMap));
      });
    },
    [handleExpressionChange, referenceMap]
  );

  // Trigger the expression change when the reference map changes to ensure the query is showing the correct data
  useEffect(() => {
    if (!isEqual(prevReferenceMap, referenceMap)) {
      const internalRepresentation = unresolveExpression(expression, prevReferenceMap);
      const expr = new Expression(
        internalRepresentation,
        new Set(Object.keys(prevReferenceMap ?? {}))
      );
      handleExpressionChange(resolveExpression(expr, referenceMap));
    }
  }, [prevReferenceMap, referenceMap, expression, handleExpressionChange]);

  return (
    <ArithmeticBuilder
      aggregations={[]}
      expression={internalExpression}
      functionArguments={[]}
      getFieldDefinition={() => null}
      references={references}
      setExpression={handleInternalExpressionChange}
    />
  );
}
