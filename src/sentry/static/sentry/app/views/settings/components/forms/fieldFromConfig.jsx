import PropTypes from 'prop-types';
import React from 'react';

import BooleanField from './booleanField';
// import RangeField from './rangeField';
// import Select2FieldAutocomplete from './select2FieldAutocomplete';
import Select2Field from './select2Field';
// import Select2TextField from './select2TextField';
import TextField from './textField';
import TextareaField from './textareaField';
import RadioField from './radioField';
import InputField from './inputField';

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
      ]),
      required: PropTypes.bool,
      multiline: PropTypes.bool,
      label: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
      placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
      help: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
      extraHelp: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
      visible: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
      disabled: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
      showReturnButton: PropTypes.bool,
      getValue: PropTypes.func,
      setValue: PropTypes.func,
    }).isRequired,
  };

  render() {
    let {field, ...otherProps} = this.props;

    // TODO(billy) Not sure of structure yet
    let props = {
      ...otherProps,
      ...field,
    };

    switch (field.type) {
      case 'secret':
        return <InputField {...props} type="password" />;
      // case 'range':
      // return <RangeField {...props} />;
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
        // for select2 elements, so just make it look like
        // it's required (with *) and rely on server validation
        delete props.required;
        // if (props.has_autocomplete) {
        // return <Select2FieldAutocomplete {...props} />;
        // }
        return <Select2Field {...props} />;
      case 'radio':
        return <RadioField {...props} />;
      default:
        return null;
    }
  }
}
