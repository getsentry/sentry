import type {RadioGroupProps} from 'sentry/components/forms/controls/radioGroup';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import FormField from 'sentry/components/forms/formField';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps, OnEvent} from './inputField';

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
    <FormField {...props}>
      {({id, onChange, onBlur, value, disabled, orientInline, ...fieldProps}: any) => (
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
    </FormField>
  );
}

export default RadioField;
