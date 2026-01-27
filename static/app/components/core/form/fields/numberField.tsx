import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Input, type InputProps} from '@sentry/scraps/input';

import {BaseField, type BaseFieldProps} from './baseField';

export function NumberField({
  label,
  hintText,
  onChange,
  required,
  ...props
}: BaseFieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: number) => void;
    value: number;
  }) {
  const autoSaveContext = useAutoSaveContext();

  return (
    <BaseField label={label} hintText={hintText} required={required}>
      {fieldProps => (
        <Input
          {...fieldProps}
          {...props}
          type="number"
          disabled={props.disabled || autoSaveContext?.isPending}
          onChange={e => onChange(Number(e.target.value))}
        />
      )}
    </BaseField>
  );
}
