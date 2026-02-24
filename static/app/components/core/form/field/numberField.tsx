import {InputField} from '@sentry/scraps/form/field/inputField';
import {type InputProps} from '@sentry/scraps/input';

import {type BaseFieldProps} from './baseField';

export function NumberField(
  props: BaseFieldProps &
    Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur' | 'disabled'> & {
      onChange: (value: number) => void;
      value: number;
      disabled?: boolean | string;
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
