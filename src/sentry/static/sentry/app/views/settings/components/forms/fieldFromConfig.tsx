import PropTypes from 'prop-types';
import React from 'react';

import {Scope} from 'app/types';

import BooleanField from './booleanField';
import EmailField from './emailField';
import HiddenField from './hiddenField';
import NumberField from './numberField';
import RangeField from './rangeField';
import SelectField from './selectField';
import TableField from './tableField';
import TextField from './textField';
import TextareaField from './textareaField';
import RadioField from './radioField';
import InputField from './inputField';
import ChoiceMapperField from './choiceMapperField';
import RichListField from './richListField';
import FieldSeparator from './fieldSeparator';
import ProjectMapperField from './projectMapperField';
import {Field} from './type';

type Props = {
  field: Field;
  highlighted?: boolean;
  disabled?: boolean | ((props) => boolean);
  flexibleControlStateSize?: boolean;
  stacked?: boolean;
  inline?: boolean;
  onBlur?: (value, event) => void;
  access?: Set<Scope>;
  deprecatedSelectControl?: boolean;
  noOptionsMessage?: () => string;
};

export default class FieldFromConfig extends React.Component<Props> {
  static propTypes = {
    field: PropTypes.shape({
      name: PropTypes.string,
      type: PropTypes.oneOf([
        'array',
        'boolean',
        'choice',
        'choice_mapper',
        'custom',
        'email',
        'hidden',
        'multichoice',
        'number',
        'radio',
        'range',
        'rich_list',
        'secret',
        'select',
        'separator',
        'string',
        'text',
        'textarea',
        'url',
        'table',
        'project_mapper',
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
    const {field, ...otherProps} = this.props;

    const props = {
      ...otherProps,
      ...field,
    };

    switch (field.type) {
      case 'separator':
        return <FieldSeparator />;
      case 'secret':
        return <InputField {...props} type="password" />;
      case 'range':
        return <RangeField {...props} />;
      case 'bool':
      case 'boolean':
        return <BooleanField {...props} />;
      case 'email':
        return <EmailField {...props} />;
      case 'hidden':
        return <HiddenField {...props} />;
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

        return <SelectField deprecatedSelectControl {...props} />;
      case 'choice_mapper':
        return <ChoiceMapperField {...props} />;
      case 'radio':
        return <RadioField {...props} />;
      case 'rich_list':
        return <RichListField {...props} />;
      case 'table':
        return <TableField {...props} />;
      case 'project_mapper':
        return <ProjectMapperField {...props} />;
      case 'custom':
        return field.Component(props);
      default:
        return null;
    }
  }
}
