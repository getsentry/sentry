import {FieldProps} from 'sentry/components/forms/field';
import FieldSeparator from 'sentry/components/forms/fieldSeparator';
import {Field} from 'sentry/components/forms/type';
import {Scope} from 'sentry/types';

import BlankField from './fields/blankField';
import BooleanField, {BooleanFieldProps} from './fields/booleanField';
import ChoiceMapperField, {ChoiceMapperFieldProps} from './fields/choiceMapperField';
import DateTimeField, {DateTimeFieldProps} from './fields/dateTimeField';
import EmailField, {EmailFieldProps} from './fields/emailField';
import FileField, {FileFieldProps} from './fields/fileField';
import HiddenField, {HiddenFieldProps} from './fields/hiddenField';
import InputField, {InputFieldProps} from './fields/inputField';
import NumberField from './fields/numberField';
import ProjectMapperField from './fields/projectMapperField';
import RadioField, {RadioFieldProps} from './fields/radioField';
import RangeField, {RangeFieldProps} from './fields/rangeField';
import SelectAsyncField, {SelectAsyncFieldProps} from './fields/selectAsyncField';
import SelectField, {SelectFieldProps} from './fields/selectField';
import SentryProjectSelectorField, {
  RenderFieldProps,
} from './fields/sentryProjectSelectorField';
import TableField from './fields/tableField';
import TextareaField, {TextareaFieldProps} from './fields/textareaField';
import TextField from './fields/textField';

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
