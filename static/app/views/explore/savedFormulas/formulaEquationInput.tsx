import {useMemo} from 'react';

import {
  ArithmeticBuilder,
  VALID_REFERENCE_PATTERN,
} from 'sentry/components/arithmeticBuilder';
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
  // Names are mid-edit while this renders, and the builder throws on one it can't
  // tokenize, so those are left as plain text until they're valid.
  const nameList = names.filter(name => VALID_REFERENCE_PATTERN.test(name)).join(',');
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
