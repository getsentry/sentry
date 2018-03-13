import PropTypes from 'prop-types';
import React from 'react';

import {defined} from '../../utils';

import BooleanField from './booleanField';
import EmailField from './emailField';
import NumberField from './numberField';
import PasswordField from './passwordField';
import RangeField from './rangeField';
import Select2FieldAutocomplete from './select2FieldAutocomplete';
import Select2Field from './select2Field';
import Select2TextField from './select2TextField';
import TextField from './textField';
import TextareaField from './textareaField';

export default class GenericField extends React.Component {
  static propTypes = {
    config: PropTypes.object.isRequired,
    formData: PropTypes.object,
    formErrors: PropTypes.object,
    formState: PropTypes.string.isRequired,
    onChange: PropTypes.func,
  };

  static defaultProps = {
    formData: {},
    formErrors: {},
  };

  render() {
    let config = this.props.config;
    let required = defined(config.required) ? config.required : true;
    let props = {
      ...config,
      value: this.props.formData[config.name],
      onChange: this.props.onChange,
      label: config.label + (required ? '*' : ''),
      placeholder: config.placeholder,
      required,
      name: config.name,
      error: (this.props.formErrors || {})[config.name],
      disabled: config.readonly,
      key: config.name,
      formState: this.props.formState,
      help:
        defined(config.help) && config.help !== '' ? (
          <span dangerouslySetInnerHTML={{__html: config.help}} />
        ) : null,
    };

    switch (config.type) {
      case 'secret':
        return <PasswordField {...props} />;
      case 'range':
        return <RangeField {...props} />;
      case 'bool':
        return <BooleanField {...props} />;
      case 'email':
        return <EmailField {...props} />;
      case 'string':
      case 'text':
      case 'url':
        if (props.choices) return <Select2TextField {...props} />;
        return <TextField {...props} />;
      case 'number':
        return <NumberField {...props} />;
      case 'textarea':
        return <TextareaField {...props} />;
      case 'choice':
      case 'select':
        // the chrome required tip winds up in weird places
        // for select2 elements, so just make it look like
        // it's required (with *) and rely on server validation
        delete props.required;
        if (props.has_autocomplete) {
          return <Select2FieldAutocomplete {...props} />;
        }
        return <Select2Field {...props} />;
      default:
        return null;
    }
  }
}
