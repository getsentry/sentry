import {useCallback, useEffect, useMemo, useRef, useTransition} from 'react';
import isEqual from 'lodash/isEqual';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {
  isTokenFreeText,
  isTokenReference,
} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';

/**
 * Takes an expression and map of references and returns the internal string representation that uses the references.
 */
function unresolveExpression(
  expression: string,
  referenceMap: Record<string, string> = {}
): string {
  // Reverse the keys and values of the reference map, duplicates keep the first reference found
  const reversedReferenceMap = Object.entries(referenceMap).reduce(
    (reversedMap: Record<string, string>, [key, value]) => {
      if (!reversedMap[value]) {
        reversedMap[value] = key;
      }
      return reversedMap;
    },
    {}
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

/**
 * Resolves the expression using references into a format that is compatible with our querying endpoints.
 */
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
  const references = useMemo(
    () => new Set(Object.keys(referenceMap ?? {})),
    [referenceMap]
  );

  // Tracks the reference map that `expression` was last resolved against.
  // When referenceMap changes externally, expression still contains values
  // resolved against the previous map until we re-resolve and the parent updates.
  const expressionMapRef = useRef(referenceMap);
  const mapChanged = !isEqual(expressionMapRef.current, referenceMap);

  const internalExpression = unresolveExpression(
    expression,
    mapChanged ? expressionMapRef.current : referenceMap
  );

  // When the reference map changes, re-resolve the expression and invoke the callback
  useEffect(() => {
    if (!isEqual(expressionMapRef.current, referenceMap)) {
      const expr = new Expression(
        internalExpression,
        new Set(Object.keys(expressionMapRef.current ?? {}))
      );
      const resolved = resolveExpression(expr, referenceMap);

      // Check the validity of the internal expression, not the resolved one because
      // there are issues with validating it with the new _if aggregation format and
      // this check just needs to ensure the structure is valid.
      if (expr.isValid) {
        handleExpressionChange(resolved);
        expressionMapRef.current = referenceMap;
      }
    }
  }, [referenceMap, internalExpression, handleExpressionChange]);

  const handleInternalExpressionChange = useCallback(
    (newExpression: Expression) => {
      startTransition(() => {
        if (newExpression.isValid) {
          handleExpressionChange(resolveExpression(newExpression, referenceMap));
        }
      });
    },
    [handleExpressionChange, referenceMap]
  );

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
