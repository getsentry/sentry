import type {Ref} from 'react';
import {mergeRefs} from '@react-aria/utils';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {type InputProps} from '@sentry/scraps/input';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Flex} from '@sentry/scraps/layout';

import {
  BaseField,
  FieldStatus,
  useAutoSaveIndicator,
  type BaseFieldProps,
} from './baseField';

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
  const autoSaveContext = useAutoSaveContext();
  const indicator = useAutoSaveIndicator();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';

  return (
    <BaseField>
      {fieldProps => (
        <Flex gap="sm" align="center">
          <InputGroup style={{flex: 1}}>
            <InputGroup.Input
              {...fieldProps}
              {...rest}
              ref={mergeRefs(fieldProps.ref as Ref<HTMLInputElement>, rest.ref)}
              disabled={isDisabled}
              onChange={e => onChange(e.target.value)}
            />
            <InputGroup.TrailingItems>
              {trailingItems}
              {indicator}
            </InputGroup.TrailingItems>
          </InputGroup>
          <FieldStatus disabled={disabled} />
        </Flex>
      )}
    </BaseField>
  );
}
