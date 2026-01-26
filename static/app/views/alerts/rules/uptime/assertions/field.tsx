import type {FormFieldProps} from 'sentry/components/forms/formField';
import FormField from 'sentry/components/forms/formField';
import {uniqueId} from 'sentry/utils/guid';
import type {Assertion, Op} from 'sentry/views/alerts/rules/uptime/types';

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

// XXX(epurkhiser): The types of the FormField render props are absolutely
// abysmal, so we're leaving this untyped for now.

function UptimeAssertionsControl({onChange, onBlur, value}: any) {
  // Handle cases where value might be undefined or not have the expected structure
  const rootOp = value?.root ?? {op: 'and' as const, children: [], id: uniqueId()};

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
      defaultValue={{root: {op: 'and', children: [], id: uniqueId()}}}
      {...props}
      flexibleControlStateSize
      // Use getValue (not getData) to transform field value at submission time.
      // getData only works for save-on-blur; getValue is used by getTransformedData()
      // which is called during full form submission via saveForm().
      getValue={(value: Assertion | undefined) =>
        value?.root ? {root: normalizeAssertion(value.root)} : value
      }
    >
      {({ref: _ref, ...fieldProps}) => <UptimeAssertionsControl {...fieldProps} />}
    </FormField>
  );
}
