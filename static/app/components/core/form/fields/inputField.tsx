import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Spinner} from '@sentry/scraps/form/spinner';
import {type InputProps} from '@sentry/scraps/input';
import {InputGroup} from '@sentry/scraps/input/inputGroup';

import {BaseField, type BaseFieldProps} from './baseField';

export function InputField({
  label,
  hintText,
  onChange,
  required,
  ...props
}: BaseFieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: string) => void;
    value: string;
  }) {
  const autoSaveContext = useAutoSaveContext();

  return (
    <BaseField label={label} hintText={hintText} required={required}>
      {fieldProps => (
        <InputGroup>
          <InputGroup.Input
            {...fieldProps}
            {...props}
            disabled={props.disabled || autoSaveContext?.isPending}
            onChange={e => onChange(e.target.value)}
          />
          <InputGroup.TrailingItems>
            {autoSaveContext?.isPending ? <Spinner /> : null}
          </InputGroup.TrailingItems>
        </InputGroup>
      )}
    </BaseField>
  );
}
