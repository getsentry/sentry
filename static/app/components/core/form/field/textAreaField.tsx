import type {Ref} from 'react';
import {mergeRefs} from '@react-aria/utils';

import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {type TextAreaProps} from '@sentry/scraps/textarea';

import {BaseField, useAutoSaveIndicator, type BaseFieldProps} from './baseField';

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
  const indicator = useAutoSaveIndicator();

  return (
    <BaseField disabled={disabled}>
      {fieldProps => (
        <InputGroup style={{flex: 1}}>
          <InputGroup.TextArea
            {...fieldProps}
            {...props}
            ref={mergeRefs(fieldProps.ref as Ref<HTMLTextAreaElement>, props.ref)}
            onChange={e => onChange(e.target.value)}
          />
          <InputGroup.TrailingItems>{indicator}</InputGroup.TrailingItems>
        </InputGroup>
      )}
    </BaseField>
  );
}
