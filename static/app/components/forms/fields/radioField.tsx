import RadioGroup, {RadioGroupProps} from 'sentry/components/forms/controls/radioGroup';

import InputField, {InputFieldProps, OnEvent} from './inputField';

export interface RadioFieldProps extends Omit<InputFieldProps, 'type'> {
  choices?: RadioGroupProps<any>['choices'];
  orientInline?: RadioGroupProps<any>['orientInline'];
}

function handleChange(
  id: string,
  onChange: OnEvent,
  onBlur: OnEvent,
  e: React.FormEvent<HTMLInputElement>
) {
  onChange(id, e);
  onBlur(id, e);
}

function RadioField(props: RadioFieldProps) {
  return (
    <InputField
      {...props}
      field={({id, onChange, onBlur, value, disabled, orientInline, ...fieldProps}) => (
        // XXX: The label must be present on the role="radiogroup" element. The
        // `htmlFor` attribute on the Field label does NOT link to the group.
        <RadioGroup
          id={id}
          choices={fieldProps.choices}
          disabled={disabled}
          orientInline={orientInline}
          label={fieldProps.label}
          value={value === '' ? null : value}
          onChange={(v, e) => handleChange(v, onChange, onBlur, e)}
        />
      )}
    />
  );
}

export default RadioField;
