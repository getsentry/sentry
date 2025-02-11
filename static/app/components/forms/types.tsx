import type {AlertProps} from 'sentry/components/alert';
import type {createFilter} from 'sentry/components/forms/controls/reactSelectWrapper';
import type {ChoiceMapperProps} from 'sentry/components/forms/fields/choiceMapperField';
import type {SelectAsyncFieldProps} from 'sentry/components/forms/fields/selectAsyncField';
import type FormModel from 'sentry/components/forms/model';
import type {SliderProps} from 'sentry/components/slider';
import type {SelectValue} from 'sentry/types/core';
import type {AvatarProject, Project} from 'sentry/types/project';

export const FieldType = [
  'array',
  'blank',
  'bool',
  'boolean',
  'choice_mapper',
  'datetime',
  'email',
  'file',
  'hidden',
  'multichoice',
  'number',
  'radio',
  'secret',
  'separator',
  'string',
  'text',
  'url',
  'table',
  'project_mapper',
  'sentry_project_selector',
  'select_async',
] as const;

export type FieldValue = any;

// TODO(ts): A lot of these attributes are missing correct types. We'll likely
// need to introduce some generics in here to get rid of some of these anys.

interface BaseField {
  name: string;
  'aria-label'?: string;
  autosize?: boolean;
  choices?:
    | ((props: {[key: string]: any}) => void)
    | ReadonlyArray<Readonly<[number | string, React.ReactNode]>>;
  confirm?: {[key: string]: React.ReactNode | boolean};
  defaultValue?: FieldValue;
  disabled?: boolean | ((props: any) => boolean);
  disabledReason?: React.ReactNode | ((props: any) => React.ReactNode);
  extraHelp?: string;
  flexibleControlStateSize?: boolean;
  formatLabel?: (value: number | '') => React.ReactNode;
  /**
   * Function to format the value displayed in the undo toast. May also be
   * specified as false to disable showing the changed fields in the toast.
   */
  formatMessageValue?: Function | false;
  getData?: (data: Record<PropertyKey, unknown>) => Record<PropertyKey, unknown>;
  getValue?: (value: FieldValue) => any;
  help?: React.ReactNode | ((props: any) => React.ReactNode);
  hideLabel?: boolean;
  // TODO(ts): FormField prop?
  inline?: boolean;
  label?: React.ReactNode | (() => React.ReactNode);
  /**
   * May be used to give the field an aria-label when the field's label is a
   * react node.
   */
  labelText?: string;
  maxRows?: number;
  // TODO(ts): used in sentryAppPublishRequestModal
  meta?: string;

  monospace?: boolean;
  multiline?: boolean;
  onChange?: (value: FieldValue) => void;
  placeholder?: string | ((props: any) => React.ReactNode);
  required?: boolean;
  /** Does editing this field need to clear all other fields? */
  resetsForm?: boolean;
  rows?: number;
  saveMessage?: React.ReactNode | ((params: {value: FieldValue}) => string);
  saveMessageAlertType?: AlertProps['type'];
  /**
   * If false, disable saveOnBlur for field, instead show a save/cancel button
   */
  saveOnBlur?: boolean;
  selectionInfoFunction?: (props: any) => React.ReactNode;

  setValue?: (value: FieldValue, props?: any) => any;

  showHelpInTooltip?: boolean;

  stacked?: boolean;

  transformInput?: (value: FieldValue) => FieldValue;

  /** Does editing this field require the Form to load new configs? */
  updatesForm?: boolean;
  validate?: (data: {form: Record<string, any>; id: string}) => string[][];
  visible?: boolean | ((props: any) => boolean);
}

// TODO(ts): These are field specific props. May not be needed as we convert
// the fields as we can grab the props from them

export interface CustomType {
  Component: (arg: BaseField) => React.ReactElement;
  type: 'custom';
}

type InputType = {type: 'string' | 'secret'} & {
  autoComplete?: string;
  maxLength?: number;
  minLength?: number;
};

type SelectControlType = {type: 'choice' | 'select'} & {
  allowClear?: boolean;
  // for new select
  defaultOptions?: Array<{label: string; value: any}> | boolean;
  filterOption?: ReturnType<typeof createFilter>;
  multiple?: boolean;
  noOptionsMessage?: () => string;
  options?: Array<SelectValue<any>>;
};

type TextareaType = {type: 'textarea'} & {
  autosize?: boolean;
  rows?: number;
};

type NumberType = {type: 'number'} & {
  max?: number;
  min?: number;
  step?: number;
};

type RangeType = {type: 'range'} & SliderProps;

type FileType = {type: 'file'} & {
  accept?: string[];
};

type DateTimeType = {type: 'datetime'};

export interface TableType {
  /**
   * A list of column keys for the table, in the order that you want
   * the columns to appear - order doesn't matter in columnLabels
   */
  columnKeys: string[];
  /**
   * An object with of column labels (headers) for the table.
   */
  columnLabels: Record<PropertyKey, unknown>;
  type: 'table';
  /**
   * The confirmation message before a a row is deleted
   */
  confirmDeleteMessage?: string;
  // TODO(TS): Should we have addButtonText and allowEmpty here as well?
}

// maps a sentry project to another field
export type ProjectMapperType = {
  iconType: string;
  mappedDropdown: {
    items: Array<{label: string; url: string; value: string | number}>;
    placeholder: string;
  };
  nextButton: {
    allowedDomain: string;
    text: string;
    // url comes from the `next` parameter in the QS
    description?: string;
  };
  sentryProjects: Array<AvatarProject & {id: number; name: string}>;
  type: 'project_mapper';
};

export type ChoiceMapperType = {
  type: 'choice_mapper';
} & ChoiceMapperProps;

// selects a sentry project with avatars
export type SentryProjectSelectorType = {
  projects: Project[];
  type: 'sentry_project_selector';
  avatarSize?: number;
};

export type SentryOrganizationRoleSelectorType = {
  type: 'sentry_organization_role_selector';
};

export type SelectAsyncType = {
  type: 'select_async';
} & SelectAsyncFieldProps;

export type Field = (
  | CustomType
  | SelectControlType
  | InputType
  | TextareaType
  | NumberType
  | RangeType
  | TableType
  | ProjectMapperType
  | SentryProjectSelectorType
  | SentryOrganizationRoleSelectorType
  | SelectAsyncType
  | ChoiceMapperType
  | {type: (typeof FieldType)[number]}
  | FileType
  | DateTimeType
) &
  BaseField;

export type FieldObject = Field | Function;

export type JsonFormObject = {
  fields: FieldObject[];
  initiallyCollapsed?: boolean;
  title?: React.ReactNode;
};

export type Data = Record<string, any>;

export type OnSubmitCallback = (
  data: Data,
  onSubmitSuccess: (data: Data) => void,
  onSubmitError: (error: any) => void,
  event: React.FormEvent,
  model: FormModel
) => void;
