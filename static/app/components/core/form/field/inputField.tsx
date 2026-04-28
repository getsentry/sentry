import {type InputProps} from '@sentry/scraps/input';
import {InputGroup} from '@sentry/scraps/input/inputGroup';

import {BaseField, type BaseFieldProps} from './baseField';

export interface InputFieldProps
  extends
    BaseFieldProps<HTMLInputElement>,
    Omit<InputProps, 'value' | 'onChange' | 'onBlur' | 'disabled' | 'id' | 'type'> {
  onChange: (value: string) => void;
  value: string;
  disabled?: boolean | string;
  trailingItems?: React.ReactNode;
  type?:
    | 'button'
    | 'checkbox'
    | 'color'
    | 'date'
    | 'datetime-local'
    | 'email'
    | 'file'
    | 'hidden'
    | 'image'
    | 'month'
    | 'number'
    | 'password'
    | 'radio'
    | 'range'
    | 'reset'
    | 'search'
    | 'submit'
    | 'tel'
    | 'text'
    | 'time'
    | 'url'
    | 'week';
}

export function InputField({
  onChange,
  disabled,
  trailingItems,
  ref,
  ...props
}: InputFieldProps) {
  return (
    <BaseField disabled={disabled} ref={ref}>
      {(fieldProps, {indicator}) => (
        <InputGroup style={{flex: 1}}>
          <InputGroup.Input
            {...fieldProps}
            {...props}
            onChange={e => onChange(e.target.value)}
          />
          <InputGroup.TrailingItems>
            {trailingItems}
            {indicator}
          </InputGroup.TrailingItems>
        </InputGroup>
      )}
    </BaseField>
  );
}
