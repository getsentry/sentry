import {useCallback, useEffect, useMemo, useTransition} from 'react';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {
  extractReferenceLabels,
  resolveExpression,
  unresolveExpression,
} from 'sentry/views/explore/metrics/equationBuilder/utils';

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
  onReferenceLabelsChange,
}: {
  expression: string;
  handleExpressionChange: (resolved: Expression, internalText: string) => void;
  onReferenceLabelsChange?: (labels: string[]) => void;
  referenceMap?: Record<string, string>;
}) {
  const [_, startTransition] = useTransition();
  const references = useMemo(
    () => new Set(Object.keys(referenceMap ?? {})),
    [referenceMap]
  );

  const internalExpression = unresolveExpression(expression, referenceMap);

  // Report which labels this equation references after unresolving.
  // Cleans up on unmount so deleted equations don't block metric deletion.
  useEffect(() => {
    const expr = new Expression(internalExpression, references);
    onReferenceLabelsChange?.(extractReferenceLabels(expr));
    return () => {
      onReferenceLabelsChange?.([]);
    };
  }, [internalExpression, references, onReferenceLabelsChange]);

  const handleInternalExpressionChange = useCallback(
    (newExpression: Expression) => {
      startTransition(() => {
        if (newExpression.isValid) {
          handleExpressionChange(
            resolveExpression(newExpression, referenceMap),
            newExpression.text
          );
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
