import BooleanField from 'sentry/components/forms/booleanField';
import EmailField from 'sentry/components/forms/emailField';
import FormField from 'sentry/components/forms/formField';
import NumberField from 'sentry/components/forms/numberField';
import PasswordField from 'sentry/components/forms/passwordField';
import SelectAsyncField from 'sentry/components/forms/selectAsyncField';
import SelectCreatableField from 'sentry/components/forms/selectCreatableField';
import SelectField from 'sentry/components/forms/selectField';
import FormState from 'sentry/components/forms/state';
import TextareaField from 'sentry/components/forms/textareaField';
import TextField from 'sentry/components/forms/textField';
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
  required?: boolean;
  help?: string;
  name: string;
  label?: string;
  placeholder: string;
  default: string;
  readonly: boolean;
  type: FieldType;
  choices: Array<[number | string, number | string]>;
};

type SelectFieldConfig = Omit<Config, 'type' | 'has_autocomplete'> & {
  type: SelectFieldType;
  has_autocomplete: false;
};

type AsyncSelectFieldConfig = Omit<SelectFieldConfig, 'has_autocomplete'> & {
  url: string;
  has_autocomplete: true;
};

interface FormData {
  [name: string]: string;
}

type Props = {
  config: Config | SelectFieldConfig | AsyncSelectFieldConfig;
  formData: FormData;
  formErrors?: object;
  formState: typeof FormState[keyof typeof FormState];
  onChange: FormField['props']['onChange'];
};

const GenericField = ({
  config,
  formData = {},
  formErrors = {},
  formState,
  onChange,
}: Props) => {
  const required = defined(config.required) ? config.required : true;
  const fieldProps = {
    ...config,
    value: formData[config.name],
    onChange,
    label: config.label + (required ? '*' : ''),
    placeholder: config.placeholder,
    required,
    name: config.name,
    error: (formErrors || {})[config.name],
    defaultValue: config.default,
    disabled: config.readonly,
    key: config.name,
    formState,
    help:
      defined(config.help) && config.help !== '' ? (
        <span dangerouslySetInnerHTML={{__html: config.help}} />
      ) : null,
  };

  switch (config.type) {
    case 'secret':
      return <PasswordField {...fieldProps} />;
    case 'bool':
      return <BooleanField {...fieldProps} />;
    case 'email':
      return <EmailField {...fieldProps} />;
    case 'string':
    case 'text':
    case 'url':
      if (fieldProps.choices) {
        return <SelectCreatableField {...fieldProps} />;
      }
      return <TextField {...fieldProps} />;
    case 'number':
      return <NumberField {...fieldProps} />;
    case 'textarea':
      return <TextareaField {...fieldProps} />;
    case 'choice':
    case 'select':
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
        return <SelectAsyncField {...selectFieldProps} />;
      }
      return <SelectField {...selectProps} />;
    default:
      return null;
  }
};

export default GenericField;
