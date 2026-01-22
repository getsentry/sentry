import type {FormFieldProps} from 'sentry/components/forms/formField';
import FormField from 'sentry/components/forms/formField';
import {uniqueId} from 'sentry/utils/guid';
import type {AndOp, Assertion, Op} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionOpGroup} from './opGroup';

/**
 * Recursively normalizes assertion values to ensure they are valid before submission.
 * Handles NaN values (from cleared inputs) and clamps to valid HTTP status code range.
 */
export function normalizeAssertion(op: Op): Op {
  switch (op.op) {
    case 'status_code_check':
      return {
        ...op,
        // Default to 200 if NaN (e.g., user cleared input and submitted without blur)
        value: isNaN(op.value) ? 200 : Math.max(100, Math.min(599, op.value)),
      };
    case 'and':
    case 'or':
      return {
        ...op,
        children: op.children.map(normalizeAssertion),
      };
    case 'not':
      return {
        ...op,
        operand: normalizeAssertion(op.operand),
      };
    default:
      return op;
  }
}

/**
 * Creates a default assertion root that validates 2xx status codes (>199 AND <300)
 */
function createDefaultAssertionRoot(): AndOp {
  return {
    op: 'and',
    id: uniqueId(),
    children: [
      {
        op: 'status_code_check',
        id: uniqueId(),
        operator: {cmp: 'greater_than'},
        value: 199,
      },
      {
        op: 'status_code_check',
        id: uniqueId(),
        operator: {cmp: 'less_than'},
        value: 300,
      },
    ],
  };
}

// XXX(epurkhiser): The types of the FormField render props are absolutely
// abysmal, so we're leaving this untyped for now.

function UptimeAssertionsControl({onChange, onBlur, value}: any) {
  // If value is explicitly null (editing monitor with no assertions), use empty structure
  // If value is undefined or has no root (new monitor), use default assertions
  const rootOp =
    value === null
      ? {op: 'and' as const, children: [], id: uniqueId()}
      : (value?.root ?? createDefaultAssertionRoot());

  return (
    <AssertionOpGroup
      root
      value={rootOp}
      onChange={op => {
        onChange({root: op}, {});
        onBlur({root: op}, {});
      }}
    />
  );
}

export function UptimeAssertionsField(props: Omit<FormFieldProps, 'children'>) {
  return (
    <FormField
      defaultValue={{root: createDefaultAssertionRoot()}}
      {...props}
      flexibleControlStateSize
      // Use getValue (not getData) to transform field value at submission time.
      // getData only works for save-on-blur; getValue is used by getTransformedData()
      // which is called during full form submission via saveForm().
      getValue={(value: Assertion | null | undefined) => {
        // If no assertions (empty children or null), send null to backend
        if (
          !value?.root ||
          ('children' in value.root && value.root.children.length === 0)
        ) {
          return null;
        }
        return {root: normalizeAssertion(value.root)};
      }}
    >
      {({ref: _ref, ...fieldProps}) => <UptimeAssertionsControl {...fieldProps} />}
    </FormField>
  );
}
