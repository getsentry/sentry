import type {FieldGroupProps} from 'sentry/components/forms/fieldGroup/types';
import SeparatorField from 'sentry/components/forms/fields/separatorField';
import type {Field} from 'sentry/components/forms/types';
import type {Scope} from 'sentry/types';

import BlankField from './fields/blankField';
import type {BooleanFieldProps} from './fields/booleanField';
import BooleanField from './fields/booleanField';
import type {ChoiceMapperFieldProps} from './fields/choiceMapperField';
import ChoiceMapperField from './fields/choiceMapperField';
import type {DateTimeFieldProps} from './fields/dateTimeField';
import DateTimeField from './fields/dateTimeField';
import type {EmailFieldProps} from './fields/emailField';
import EmailField from './fields/emailField';
import type {FileFieldProps} from './fields/fileField';
import FileField from './fields/fileField';
import type {HiddenFieldProps} from './fields/hiddenField';
import HiddenField from './fields/hiddenField';
import type {NumberFieldProps} from './fields/numberField';
import NumberField from './fields/numberField';
import type {ProjectMapperProps} from './fields/projectMapperField';
import ProjectMapperField from './fields/projectMapperField';
import type {RadioFieldProps} from './fields/radioField';
import RadioField from './fields/radioField';
import type {RangeFieldProps} from './fields/rangeField';
import RangeField from './fields/rangeField';
import type {SecretFieldProps} from './fields/secretField';
import SecretField from './fields/secretField';
import type {SelectAsyncFieldProps} from './fields/selectAsyncField';
import SelectAsyncField from './fields/selectAsyncField';
import type {SelectFieldProps} from './fields/selectField';
import SelectField from './fields/selectField';
import SentryOrganizationRoleSelectorField from './fields/sentryOrganizationRoleSelectorField';
import type {RenderFieldProps} from './fields/sentryProjectSelectorField';
import SentryProjectSelectorField from './fields/sentryProjectSelectorField';
import type {TableFieldProps} from './fields/tableField';
import TableField from './fields/tableField';
import type {TextareaFieldProps} from './fields/textareaField';
import TextareaField from './fields/textareaField';
import type {TextFieldProps} from './fields/textField';
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
      return <SeparatorField />;
    case 'secret':
      return <SecretField {...(componentProps as SecretFieldProps)} />;
    case 'range':
      return <RangeField {...(componentProps as RangeFieldProps)} />;
    case 'blank':
      return <BlankField {...(componentProps as FieldGroupProps)} />;
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
      return <TextField {...(componentProps as TextFieldProps)} />;
    case 'number':
      return <NumberField {...(componentProps as NumberFieldProps)} />;
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
      return <TableField {...(componentProps as TableFieldProps)} />;
    case 'project_mapper':
      return <ProjectMapperField {...(componentProps as ProjectMapperProps)} />;
    case 'sentry_project_selector':
      return <SentryProjectSelectorField {...(componentProps as RenderFieldProps)} />;
    case 'sentry_organization_role_selector':
      return (
        <SentryOrganizationRoleSelectorField {...(componentProps as RenderFieldProps)} />
      );
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
