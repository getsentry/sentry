import type {Ref} from 'react';
import {mergeRefs} from '@react-aria/utils';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Flex} from '@sentry/scraps/layout';
import {type TextAreaProps} from '@sentry/scraps/textarea';

import {
  BaseField,
  FieldStatus,
  useAutoSaveIndicator,
  type BaseFieldProps,
} from './baseField';

export function TextAreaField({
  onChange,
  disabled,
  ...props
}: BaseFieldProps &
  Omit<TextAreaProps, 'value' | 'onChange' | 'onBlur' | 'disabled'> & {
    onChange: (value: string) => void;
    value: string;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useAutoSaveIndicator();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';

  return (
    <BaseField>
      {fieldProps => (
        <Flex gap="sm" align="center">
          <InputGroup style={{flex: 1}}>
            <InputGroup.TextArea
              {...fieldProps}
              {...props}
              ref={mergeRefs(fieldProps.ref as Ref<HTMLTextAreaElement>, props.ref)}
              disabled={isDisabled}
              onChange={e => onChange(e.target.value)}
            />
            <InputGroup.TrailingItems>{indicator}</InputGroup.TrailingItems>
          </InputGroup>
          <FieldStatus disabled={disabled} />
        </Flex>
      )}
    </BaseField>
  );
}
