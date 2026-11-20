import {useCallback} from 'react';

import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {EquationBuilder} from 'sentry/views/explore/metrics/equationBuilder';

interface TraceMetricEquationRowProps {
  /**
   * The equation in letter form, e.g. `A + B`. This is what the user edits.
   */
  expression: string;
  onChange: (expression: string) => void;
  /**
   * Row letter (A, B, ...) to the aggregate it stands for.
   */
  referenceMap: Record<string, string>;
  /**
   * The equation in its saved, fully inlined form (without the `equation|`
   * prefix), for the builder's validation.
   */
  resolved: string;
  disabled?: boolean;
}

/**
 * Equation row for the trace metrics visualize list. The row model keeps the
 * equation in letter form, so this only reports the letters typed; resolving
 * them to aggregates happens when the saved fields are derived.
 */
export function TraceMetricEquationRow({
  expression,
  resolved,
  referenceMap,
  disabled,
  onChange,
}: TraceMetricEquationRowProps) {
  const handleExpressionChange = useCallback(
    (_resolved: Expression, internalText: string) => {
      onChange(internalText);
    },
    [onChange]
  );

  return (
    <EquationBuilder
      expression={resolved}
      referenceMap={referenceMap}
      handleExpressionChange={handleExpressionChange}
      storedInternalExpression={expression}
      disabled={disabled}
    />
  );
}
