import {InputField} from '@sentry/scraps/form/field/inputField';

import type {InputFieldProps} from './inputField';

export function NumberField(
  props: Omit<InputFieldProps, 'type' | 'value' | 'onChange'> & {
    onChange: (value: number) => void;
    value: number;
  }
) {
  return (
    <InputField
      {...props}
      value={String(props.value)}
      onChange={value => props.onChange(Number(value))}
      type="number"
    />
  );
}
