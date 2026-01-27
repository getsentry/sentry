import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {type InputProps} from '@sentry/scraps/input';
import {InputGroup} from '@sentry/scraps/input/inputGroup';

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
      {(fieldProps, {indicator}) => (
        <InputGroup>
          <InputGroup.Input
            {...fieldProps}
            {...props}
            type="number"
            disabled={props.disabled || autoSaveContext?.status === 'pending'}
            onChange={e => onChange(e.target.valueAsNumber)}
          />
          <InputGroup.TrailingItems>{indicator}</InputGroup.TrailingItems>
        </InputGroup>
      )}
    </BaseField>
  );
}
