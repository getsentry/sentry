import type {Ref} from 'react';
import {mergeRefs} from '@react-aria/utils';

import {type InputProps} from '@sentry/scraps/input';
import {InputGroup} from '@sentry/scraps/input/inputGroup';

import {BaseField, useAutoSaveIndicator, type BaseFieldProps} from './baseField';

export interface InputFieldProps
  extends
    BaseFieldProps,
    Omit<InputProps, 'value' | 'onChange' | 'onBlur' | 'disabled' | 'id'> {
  onChange: (value: string) => void;
  value: string;
  disabled?: boolean | string;
  trailingItems?: React.ReactNode;
}

export function InputField(props: InputFieldProps) {
  const {onChange, disabled, trailingItems, ...rest} = props;
  const indicator = useAutoSaveIndicator();

  return (
    <BaseField disabled={disabled}>
      {fieldProps => (
        <InputGroup style={{flex: 1}}>
          <InputGroup.Input
            {...fieldProps}
            {...rest}
            ref={mergeRefs(fieldProps.ref as Ref<HTMLInputElement>, rest.ref)}
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
