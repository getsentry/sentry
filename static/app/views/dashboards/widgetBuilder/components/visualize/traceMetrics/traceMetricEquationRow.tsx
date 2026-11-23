import {useCallback} from 'react';

import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {EquationBuilder} from 'sentry/views/explore/metrics/equationBuilder';

interface TraceMetricEquationRowProps {
  /**
   * Label form, e.g. `A + B`.
   */
  expression: string;
  onChange: (expression: string) => void;
  referenceMap: Record<string, string>;
  /**
   * Saved form, for validation.
   */
  resolved: string;
  disabled?: boolean;
}

/**
 * Edits the label form of an equation. Labels are resolved to aggregates when
 * the saved fields are derived.
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
