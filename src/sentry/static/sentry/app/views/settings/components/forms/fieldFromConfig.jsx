import PropTypes from 'prop-types';
import React from 'react';

import BooleanField from './booleanField';
import EmailField from './emailField';
import NumberField from './numberField';
import RangeField from './rangeField';
import SelectField from './selectField';
import TextField from './textField';
import TextareaField from './textareaField';
import RadioField from './radioField';
import InputField from './inputField';
import ChoiceMapper from './choiceMapper';

export default class FieldFromConfig extends React.Component {
  static propTypes = {
    field: PropTypes.shape({
      name: PropTypes.string,
      type: PropTypes.oneOf([
        'array',
        'boolean',
        'choice',
        'choice_mapper',
        'email',
        'multichoice',
        'number',
        'radio',
        'range',
        'secret',
        'select',
        'string',
        'text',
        'textarea',
        'url',
      ]),
      required: PropTypes.bool,
      multiline: PropTypes.bool,
      label: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
      placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
      help: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
      visible: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
      disabled: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
      /**
       * Function to format the value displayed in the undo toast. May also be
       * specified as false to disable showing the changed fields in the toast.
       */
      formatMessageValue: PropTypes.oneOfType([PropTypes.func, PropTypes.oneOf([false])]),
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
        return <EmailField {...props} />;
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
        return <NumberField {...props} />;
      case 'textarea':
        return <TextareaField {...props} />;
      case 'choice':
      case 'select':
      case 'array':
        // TODO(billy): Handle `props.has_autocomplete` with an "async" SelectField
        // if (props.has_autocomplete) {
        // return <SelectAsyncField {...props} />;
        // }

        return <SelectField {...props} />;
      case 'choice_mapper':
        return <ChoiceMapper {...props} />;
      case 'radio':
        return <RadioField {...props} />;
      default:
        return null;
    }
  }
}
