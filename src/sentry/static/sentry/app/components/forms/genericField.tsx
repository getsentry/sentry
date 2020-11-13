import PropTypes from 'prop-types';
import React from 'react';

import {defined} from 'app/utils';
import BooleanField from 'app/components/forms/booleanField';
import EmailField from 'app/components/forms/emailField';
import FormField from 'app/components/forms/formField';
import NumberField from 'app/components/forms/numberField';
import PasswordField from 'app/components/forms/passwordField';
import RangeField from 'app/components/forms/rangeField';
import SelectAsyncField from 'app/components/forms/selectAsyncField';
import SelectField from 'app/components/forms/selectField';
import SelectCreatableField from 'app/components/forms/selectCreatableField';
import TextField from 'app/components/forms/textField';
import TextareaField from 'app/components/forms/textareaField';
import FormState from 'app/components/forms/state';

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
    case 'range':
      return <RangeField {...fieldProps} />;
    case 'bool':
      return <BooleanField {...fieldProps} />;
    case 'email':
      return <EmailField {...fieldProps} />;
    case 'string':
    case 'text':
    case 'url':
      if (fieldProps.choices) {
        return <SelectCreatableField deprecatedSelectControl {...fieldProps} />;
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
        return <SelectAsyncField deprecatedSelectControl {...selectFieldProps} />;
      }
      return <SelectField deprecatedSelectControl {...selectProps} />;
    default:
      return null;
  }
};

GenericField.propTypes = {
  config: PropTypes.object.isRequired,
  formData: PropTypes.object,
  formErrors: PropTypes.object,
  formState: PropTypes.string.isRequired,
  onChange: PropTypes.func,
};

export default GenericField;
