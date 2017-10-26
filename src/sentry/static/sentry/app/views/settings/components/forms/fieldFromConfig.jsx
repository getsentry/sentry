import PropTypes from 'prop-types';
import React from 'react';

import BooleanField from './booleanField';
// import EmailField from './emailField';
// import NumberField from './numberField';
import PasswordField from './passwordField';
// import RangeField from './rangeField';
// import Select2FieldAutocomplete from './select2FieldAutocomplete';
import Select2Field from './select2Field';
// import Select2TextField from './select2TextField';
import TextField from './textField';
import TextareaField from './textareaField';

export default class FieldFromConfig extends React.Component {
  static propTypes = {
    field: PropTypes.shape({
      name: PropTypes.string,
      type: PropTypes.oneOf(['string', 'array', 'boolean']),
      required: PropTypes.bool,
      multiline: PropTypes.bool,
      label: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
      placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
      help: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
      extraHelp: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
      visible: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
      getValue: PropTypes.func,
      setValue: PropTypes.func,
    }).isRequired,
  };

  static defaultProps = {
    formData: {},
    formErrors: {},
  };

  render() {
    let {field, ...otherProps} = this.props;

    // TODO(billy) Not sure of structure yet
    let props = {
      ...otherProps,
      ...field,
    };

    // let props = Object.assign(Object.assign({}, field), {
    // value: this.props.formData[field.name],
    // onChange: this.props.onChange,
    // label: field.label + (required ? '*' : ''),
    // required,
    // error: (this.props.formErrors || {})[field.name],
    // disabled: field.readonly,
    // key: field.name,
    // formState: this.props.formState,
    // help:
    // defined(field.help) && field.help !== '' ? (
    // <span dangerouslySetInnerHTML={{__html: field.help}} />
    // ) : null,
    // });

    switch (field.type) {
      case 'secret':
        return <PasswordField {...props} />;
      // case 'range':
      // return <RangeField {...props} />;
      case 'bool':
      case 'boolean':
        return <BooleanField {...props} />;
      // case 'email':
      // return <EmailField {...props} />;
      case 'string':
      case 'text':
      case 'url':
        if (props.multiline) {
          return <TextareaField {...props} />;
        }
        // if (props.choices) return <Select2TextField {...props} />;
        return <TextField {...props} />;
      // case 'number':
      // return <NumberField {...props} />;
      case 'textarea':
        return <TextareaField {...props} />;
      case 'choice':
      case 'select':
        // the chrome required tip winds up in weird places
        // for select2 elements, so just make it look like
        // it's required (with *) and rely on server validation
        delete props.required;
        // if (props.has_autocomplete) {
        // return <Select2FieldAutocomplete {...props} />;
        // }
        return <Select2Field {...props} />;
      default:
        return null;
    }
  }
}
