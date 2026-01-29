import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {type InputProps} from '@sentry/scraps/input';
import {InputGroup} from '@sentry/scraps/input/inputGroup';

import {BaseField, type BaseFieldProps} from './baseField';

export function InputField({
  onChange,
  ...props
}: BaseFieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: string) => void;
    value: string;
  }) {
  const autoSaveContext = useAutoSaveContext();

  return (
    <BaseField>
      {(fieldProps, {indicator}) => (
        <InputGroup>
          <InputGroup.Input
            {...fieldProps}
            {...props}
            disabled={props.disabled || autoSaveContext?.status === 'pending'}
            onChange={e => onChange(e.target.value)}
          />
          <InputGroup.TrailingItems>{indicator}</InputGroup.TrailingItems>
        </InputGroup>
      )}
    </BaseField>
  );
}
