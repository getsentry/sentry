import type {FormFieldProps} from 'sentry/components/forms/formField';
import FormField from 'sentry/components/forms/formField';
import {uniqueId} from 'sentry/utils/guid';

import {AssertionOpGroup} from './opGroup';

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
    >
      {({ref: _ref, ...fieldProps}) => <UptimeAssertionsControl {...fieldProps} />}
    </FormField>
  );
}
