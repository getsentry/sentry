import {useCallback, useState} from 'react';

import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {EquationBuilder} from 'sentry/views/explore/metrics/equationBuilder';

import {unresolveEquationWithDuplicates} from './unifiedEquations';

interface TraceMetricEquationRowProps {
  /**
   * The equation in its saved, fully inlined form (without the `equation|` prefix).
   */
  equation: string;
  onUpdate: (equation: string) => void;
  /**
   * Row label (A, B, ...) to the aggregate it stands for.
   */
  referenceMap: Record<string, string>;
  disabled?: boolean;
}

/**
 * Equation row for the trace metrics visualize list. The user edits the
 * equation with row letters; the saved equation is always the inlined form.
 */
export function TraceMetricEquationRow({
  equation,
  referenceMap,
  disabled,
  onUpdate,
}: TraceMetricEquationRowProps) {
  // The letter form the user typed, kept while the saved equation it produced
  // is still the current one and the letters still mean the same rows. When
  // either changes from elsewhere (a referenced row was edited, or rows were
  // reordered) the letters are derived again.
  const references = JSON.stringify(referenceMap);
  const [internal, setInternal] = useState<{
    equation: string;
    references: string;
    text: string;
  } | null>(null);

  const handleExpressionChange = useCallback(
    (resolved: Expression, internalText: string) => {
      setInternal({equation: resolved.text, references, text: internalText});
      onUpdate(resolved.text);
    },
    [onUpdate, references]
  );

  return (
    <EquationBuilder
      expression={equation}
      referenceMap={referenceMap}
      handleExpressionChange={handleExpressionChange}
      storedInternalExpression={
        internal?.equation === equation && internal.references === references
          ? internal.text
          : unresolveEquationWithDuplicates(equation, referenceMap)
      }
      disabled={disabled}
    />
  );
}
