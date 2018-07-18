import PropTypes from 'prop-types';
import React from 'react';

import BooleanField from 'app/views/settings/components/forms/booleanField';
import RangeField from 'app/views/settings/components/forms/rangeField';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextField from 'app/views/settings/components/forms/textField';
import TextareaField from 'app/views/settings/components/forms/textareaField';
import RadioField from 'app/views/settings/components/forms/radioField';
import InputField from 'app/views/settings/components/forms/inputField';

export default class FieldFromConfig extends React.Component {
  static propTypes = {
    field: PropTypes.shape({
      name: PropTypes.string,
      type: PropTypes.oneOf([
        'secret',
        'string',
        'array',
        'boolean',
        'radio',
        'choice',
        'select',
        'multichoice',
        'range',
      ]),
      required: PropTypes.bool,
      multiline: PropTypes.bool,
      label: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
      placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
      help: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
      visible: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
      disabled: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
      /**
       * Should show a "return key" icon in input?
       */
      showReturnButton: PropTypes.bool,
      /**
       * Iff false, disable saveOnBlur for field, instead show a save/cancel button
       */
      saveOnBlur: PropTypes.bool,
      getValue: PropTypes.func,
      setValue: PropTypes.func,
    }).isRequired,
  };

  render() {
    let {field, ...otherProps} = this.props;

    let props = {
      ...otherProps,
      ...field,
    };

    switch (field.type) {
      case 'secret':
        return <InputField {...props} type="password" />;
      case 'range':
        return <RangeField {...props} />;
      case 'bool':
      case 'boolean':
        return <BooleanField {...props} />;
      case 'email':
        return <InputField {...props} type="email" />;
      case 'string':
      case 'text':
      case 'url':
        if (props.multiline) {
          return <TextareaField {...props} />;
        }

        // TODO(billy): Handle `props.choices` with a "creatable" SelectField
        // if (props.choices) return <Select2TextField {...props} />;

        return <TextField {...props} />;
      case 'number':
        return <InputField {...props} type="number" />;
      case 'textarea':
        return <TextareaField {...props} />;
      case 'choice':
      case 'select':
      case 'array':
        // the chrome required tip winds up in weird places
        // so just make it look like it's required in field (with *),
        // and rely on server validation
        delete props.required;

        // TODO(billy): Handle `props.has_autocomplete` with an "async" SelectField
        // if (props.has_autocomplete) {
        // return <SelectAsyncField {...props} />;
        // }

        return <SelectField {...props} />;
      case 'radio':
        return <RadioField {...props} />;
      default:
        return null;
    }
  }
}
