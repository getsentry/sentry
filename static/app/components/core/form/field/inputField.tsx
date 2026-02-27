import {type InputProps} from '@sentry/scraps/input';
import {InputGroup} from '@sentry/scraps/input/inputGroup';

import {BaseField, useAutoSaveIndicator, type BaseFieldProps} from './baseField';

export interface InputFieldProps
  extends
    BaseFieldProps<HTMLInputElement>,
    Omit<InputProps, 'value' | 'onChange' | 'onBlur' | 'disabled' | 'id'> {
  onChange: (value: string) => void;
  value: string;
  disabled?: boolean | string;
  trailingItems?: React.ReactNode;
}

export function InputField({
  onChange,
  disabled,
  trailingItems,
  ref,
  ...props
}: InputFieldProps) {
  const indicator = useAutoSaveIndicator();

  return (
    <BaseField disabled={disabled} ref={ref}>
      {fieldProps => (
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
