import {Scope} from 'sentry/types';

import BlankField from './blankField';
import BooleanField, {BooleanFieldProps} from './booleanField';
import ChoiceMapperField, {ChoiceMapperFieldProps} from './choiceMapperField';
import DateTimeField, {DateTimeFieldProps} from './dateTimeField';
import EmailField, {EmailFieldProps} from './emailField';
import {FieldProps} from './field';
import FieldSeparator from './fieldSeparator';
import FileField, {FileFieldProps} from './fileField';
import HiddenField, {HiddenFieldProps} from './hiddenField';
import InputField, {InputFieldProps} from './inputField';
import NumberField from './numberField';
import ProjectMapperField from './projectMapperField';
import RadioField, {RadioFieldProps} from './radioField';
import RangeField, {RangeFieldProps} from './rangeField';
import SelectAsyncField, {SelectAsyncFieldProps} from './selectAsyncField';
import SelectField, {SelectFieldProps} from './selectField';
import SentryProjectSelectorField, {RenderFieldProps} from './sentryProjectSelectorField';
import TableField from './tableField';
import TextareaField, {TextareaFieldProps} from './textareaField';
import TextField from './textField';
import {Field} from './type';

interface FieldFromConfigProps {
  field: Field;
  access?: Set<Scope>;

  disabled?: boolean | ((props) => boolean);
  flexibleControlStateSize?: boolean;
  getData?: (data) => any;
  highlighted?: boolean;
  inline?: boolean;
  noOptionsMessage?: () => string;
  onBlur?: (value, event) => void;
  stacked?: boolean;
}

function FieldFromConfig(props: FieldFromConfigProps): React.ReactElement | null {
  const {field, ...otherProps} = props;

  const componentProps = {
    ...otherProps,
    ...field,
  };

  switch (field.type) {
    case 'separator':
      return <FieldSeparator />;
    case 'secret':
      return <InputField {...(componentProps as InputFieldProps)} type="password" />;
    case 'range':
      return <RangeField {...(componentProps as RangeFieldProps)} />;
    case 'blank':
      return <BlankField {...(componentProps as FieldProps)} />;
    case 'bool':
    case 'boolean':
      return <BooleanField {...(componentProps as BooleanFieldProps)} />;
    case 'email':
      return <EmailField {...(componentProps as EmailFieldProps)} />;
    case 'hidden':
      return <HiddenField {...(componentProps as HiddenFieldProps)} />;
    case 'string':
    case 'text':
    case 'url':
      if (componentProps.multiline) {
        return <TextareaField {...(componentProps as TextareaFieldProps)} />;
      }
      return <TextField {...componentProps} />;
    case 'number':
      return <NumberField {...componentProps} />;
    case 'textarea':
      return <TextareaField {...(componentProps as TextareaFieldProps)} />;
    case 'choice':
    case 'select':
    case 'array':
      return <SelectField {...(componentProps as SelectFieldProps<any>)} />;
    case 'choice_mapper':
      return <ChoiceMapperField {...(componentProps as ChoiceMapperFieldProps)} />;
    case 'radio':
      if (Array.isArray(componentProps.choices)) {
        return <RadioField {...(componentProps as RadioFieldProps)} />;
      }
      throw new Error('Invalid `choices` type. Use an array of options');
    case 'table':
      return <TableField {...(componentProps as InputFieldProps)} />;
    case 'project_mapper':
      return <ProjectMapperField {...(componentProps as InputFieldProps)} />;
    case 'sentry_project_selector':
      return <SentryProjectSelectorField {...(componentProps as RenderFieldProps)} />;
    case 'select_async':
      return <SelectAsyncField {...(componentProps as SelectAsyncFieldProps)} />;
    case 'file':
      return <FileField {...(componentProps as FileFieldProps)} />;
    case 'datetime':
      return <DateTimeField {...(componentProps as DateTimeFieldProps)} />;
    case 'custom':
      return field.Component(field);
    default:
      return null;
  }
}

export default FieldFromConfig;
