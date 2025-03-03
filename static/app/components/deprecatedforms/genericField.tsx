import BooleanField from 'sentry/components/deprecatedforms/booleanField';
import EmailField from 'sentry/components/deprecatedforms/emailField';
import type FormField from 'sentry/components/deprecatedforms/formField';
import NumberField from 'sentry/components/deprecatedforms/numberField';
import PasswordField from 'sentry/components/deprecatedforms/passwordField';
import SelectAsyncField from 'sentry/components/deprecatedforms/selectAsyncField';
import SelectCreatableField from 'sentry/components/deprecatedforms/selectCreatableField';
import SelectField from 'sentry/components/deprecatedforms/selectField';
import TextareaField from 'sentry/components/deprecatedforms/textareaField';
import TextField from 'sentry/components/deprecatedforms/textField';
import type FormState from 'sentry/components/forms/state';
import {defined} from 'sentry/utils';

type FieldType =
  | 'secret'
  | 'range'
  | 'bool'
  | 'email'
  | 'string'
  | 'text'
  | 'url'
  | 'number'
  | 'textarea';

type SelectFieldType = 'select' | 'choice';

type Config = {
  choices: Array<[number | string, number | string]>;
  default: string;
  name: string;
  placeholder: string;
  readonly: boolean;
  type: FieldType;
  help?: string;
  label?: string;
  required?: boolean;
};

type SelectFieldConfig = Omit<Config, 'type' | 'has_autocomplete'> & {
  has_autocomplete: false;
  type: SelectFieldType;
};

type AsyncSelectFieldConfig = Omit<SelectFieldConfig, 'has_autocomplete'> & {
  has_autocomplete: true;
  url: string;
};

interface FormData {
  [name: string]: string;
}

type Props = {
  config: Config | SelectFieldConfig | AsyncSelectFieldConfig;
  formData: FormData;
  formState: (typeof FormState)[keyof typeof FormState];
  onChange: FormField['props']['onChange'];
  formErrors?: Record<PropertyKey, string>;
};

function GenericField({
  config,
  formData = {},
  formErrors = {},
  formState,
  onChange,
}: Props) {
  const required = defined(config.required) ? config.required : true;
  const fieldProps = {
    ...config,
    value: formData[config.name],
    onChange,
    label: config.label + (required ? '*' : ''),
    placeholder: config.placeholder,
    required,
    name: config.name,
    error: formErrors?.[config.name],
    defaultValue: config.default,
    disabled: config.readonly,
    formState,
    help:
      defined(config.help) && config.help !== '' ? (
        <span dangerouslySetInnerHTML={{__html: config.help}} />
      ) : null,
  };

  switch (config.type) {
    case 'secret':
      return <PasswordField key={config.name} {...fieldProps} />;
    case 'bool':
      return <BooleanField key={config.name} {...fieldProps} />;
    case 'email':
      return <EmailField key={config.name} {...fieldProps} />;
    case 'string':
    case 'text':
    case 'url':
      if (fieldProps.choices) {
        return <SelectCreatableField key={config.name} {...fieldProps} />;
      }
      return <TextField key={config.name} {...fieldProps} />;
    case 'number':
      return <NumberField key={config.name} {...fieldProps} />;
    case 'textarea':
      return <TextareaField key={config.name} {...fieldProps} />;
    case 'choice':
    case 'select': {
      // the chrome required tip winds up in weird places
      // for select elements, so just make it look like
      // it's required (with *) and rely on server validation
      const {required: _, ...selectProps} = fieldProps;
      if (config.has_autocomplete) {
        // Redeclaring field props here as config has been narrowed to include the correct options for SelectAsyncField
        const selectFieldProps = {
          ...config,
          ...selectProps,
        };
        return <SelectAsyncField key={config.name} {...selectFieldProps} />;
      }
      return <SelectField key={config.name} {...selectProps} />;
    }
    default:
      return null;
  }
}

export default GenericField;
