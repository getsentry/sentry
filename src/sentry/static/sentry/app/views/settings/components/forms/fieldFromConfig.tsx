import React from 'react';
import PropTypes from 'prop-types';

import {Scope} from 'app/types';

import BooleanField from './booleanField';
import ChoiceMapperField from './choiceMapperField';
import EmailField from './emailField';
import FieldSeparator from './fieldSeparator';
import HiddenField from './hiddenField';
import InputField from './inputField';
import NumberField from './numberField';
import ProjectMapperField from './projectMapperField';
import RadioField from './radioField';
import RangeField from './rangeField';
import RichListField from './richListField';
import SelectField from './selectField';
import SentryProjectSelectorField from './sentryProjectSelectorField';
import TableField from './tableField';
import TextareaField from './textareaField';
import TextField from './textField';
import {Field} from './type';

type Props = {
  field: Field;
  highlighted?: boolean;
  disabled?: boolean | ((props) => boolean);
  flexibleControlStateSize?: boolean;
  getData?: (data) => any;
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
        'sentry_project_selector',
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
        const choices = props.choices;
        if (!Array.isArray(choices)) {
          throw new Error('Invalid `choices` type. Use an array of options');
        }
        return <RadioField {...props} choices={choices} />;
      case 'rich_list':
        return <RichListField {...props} />;
      case 'table':
        return <TableField {...props} />;
      case 'project_mapper':
        return <ProjectMapperField {...props} />;
      case 'sentry_project_selector':
        return <SentryProjectSelectorField {...props} />;
      case 'custom':
        return field.Component(props);
      default:
        return null;
    }
  }
}
