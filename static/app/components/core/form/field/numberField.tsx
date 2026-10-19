import {InputField} from '@sentry/scraps/form/field/inputField';
import type {AnyFieldApi} from '@sentry/scraps/form/formHelpers';

import type {InputFieldProps} from './inputField';

export function NumberField(
  props: Omit<InputFieldProps, 'type' | 'value' | 'onChange'> & {
    field: AnyFieldApi;
    onChange: (value: number | null) => void;
    value: number | null;
  }
) {
  return (
    <InputField
      {...props}
      value={props.value === null ? '' : String(props.value)}
      onChange={value => props.onChange(value === '' ? null : Number(value))}
      type="number"
    />
  );
}
