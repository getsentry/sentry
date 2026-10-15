import {useMemo} from 'react';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';

/**
 * An equation that can refer to the formula's params and references by name, which
 * the arithmetic builder renders as the removable tokens metric equations use. The
 * API wraps those names in `{}`, the builder works on the bare names.
 */
export function FormulaEquationInput({
  value,
  names,
  onChange,
  disabled,
}: {
  names: string[];
  onChange: (expression: string) => void;
  value: string;
  disabled?: boolean;
}) {
  const nameList = names.filter(Boolean).join(',');
  const references = useMemo(
    () => new Set(nameList ? nameList.split(',') : []),
    [nameList]
  );

  return (
    <ArithmeticBuilder
      aggregations={[]}
      functionArguments={[]}
      getFieldDefinition={() => null}
      references={references}
      expression={value}
      setExpression={(expression: Expression) => onChange(expression.text)}
      disabled={disabled}
    />
  );
}
