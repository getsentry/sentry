import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Input, type InputProps} from '@sentry/scraps/input';

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
        <Input
          {...fieldProps}
          {...props}
          disabled={props.disabled || autoSaveContext?.isPending}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </BaseField>
  );
}
