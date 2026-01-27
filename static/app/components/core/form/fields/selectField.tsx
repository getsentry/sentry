import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Select} from '@sentry/scraps/select';

import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import type {SelectValue} from 'sentry/types/core';

import {BaseField, type BaseFieldProps} from './baseField';

function SelectInput({
  selectProps,
  ...props
}: React.ComponentProps<typeof components.Input> & {
  selectProps: {'aria-invalid': boolean};
}) {
  return <components.Input {...props} aria-invalid={selectProps['aria-invalid']} />;
}

export function SelectField({
  label,
  hintText,
  onChange,
  required,
  ...props
}: BaseFieldProps &
  Omit<React.ComponentProps<typeof Select>, 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: string) => void;
    value: string;
    disabled?: boolean;
  }) {
  const autoSaveContext = useAutoSaveContext();

  return (
    <BaseField label={label} hintText={hintText} required={required}>
      {fieldProps => (
        <Select
          {...fieldProps}
          {...props}
          disabled={props.disabled || autoSaveContext?.isPending}
          components={{...props.components, Input: SelectInput}}
          onChange={(option: SelectValue<string>) => onChange(option?.value ?? '')}
        />
      )}
    </BaseField>
  );
}
