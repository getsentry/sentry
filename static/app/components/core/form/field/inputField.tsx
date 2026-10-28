import {type InputProps} from '@sentry/scraps/input';
import {InputGroup} from '@sentry/scraps/input';

import {BaseField, type BaseFieldProps} from './baseField';

interface SharedInputFieldProps
  extends
    BaseFieldProps<HTMLInputElement>,
    Omit<
      InputProps,
      'value' | 'onChange' | 'onBlur' | 'disabled' | 'id' | 'type' | 'readOnly'
    > {
  value: string;
  disabled?: boolean | string;
  leadingItems?: React.ReactNode;
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

export type InputFieldProps = SharedInputFieldProps &
  (
    | {readOnly: true; onChange?: (value: string) => void}
    | {onChange: (value: string) => void; readOnly?: boolean}
  );

export function InputField({
  onChange,
  disabled,
  leadingItems,
  trailingItems,
  ref,
  ...props
}: InputFieldProps) {
  return (
    <BaseField disabled={disabled} ref={ref}>
      {(fieldProps, {indicator}) => (
        <InputGroup style={{flex: 1}}>
          {leadingItems && (
            <InputGroup.LeadingItems>{leadingItems}</InputGroup.LeadingItems>
          )}
          <InputGroup.Input
            {...fieldProps}
            {...props}
            onChange={onChange ? e => onChange(e.target.value) : undefined}
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
