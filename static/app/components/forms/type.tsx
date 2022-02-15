import * as React from 'react';
import {createFilter} from 'react-select';

import Alert from 'sentry/components/alert';
import {ChoiceMapperProps} from 'sentry/components/forms/choiceMapperField';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import FormModel from 'sentry/components/forms/model';
import {SelectAsyncFieldProps} from 'sentry/components/forms/selectAsyncField';
import {AvatarProject, Project} from 'sentry/types';

export const FieldType = [
  'array',
  'blank',
  'bool',
  'boolean',
  'choice_mapper',
  'email',
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

type BaseField = {
  name: string;
  autosize?: boolean;
  choices?:
    | ((props: {[key: string]: any}) => void)
    | readonly Readonly<[number | string, React.ReactNode]>[];
  confirm?: {[key: string]: React.ReactNode};
  defaultValue?: FieldValue;
  disabled?: boolean | ((props: any) => boolean);
  disabledReason?: string;
  extraHelp?: string;
  flexibleControlStateSize?: boolean;
  formatLabel?: (value: number | '') => React.ReactNode;
  /**
   * Function to format the value displayed in the undo toast. May also be
   * specified as false to disable showing the changed fields in the toast.
   */
  formatMessageValue?: Function | false;
  getData?: (data: object) => object;
  getValue?: (value: FieldValue) => any;
  help?: React.ReactNode | ((props: any) => React.ReactNode);
  hideLabel?: boolean;
  // TODO(ts): FormField prop?
  inline?: boolean;
  label?: React.ReactNode | (() => React.ReactNode);
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
  saveMessage?: React.ReactNode | ((params: {value: FieldValue}) => string);
  saveMessageAlertType?: React.ComponentProps<typeof Alert>['type'];
  /**
   * If false, disable saveOnBlur for field, instead show a save/cancel button
   */
  saveOnBlur?: boolean;
  selectionInfoFunction?: (props: any) => React.ReactNode;

  setValue?: (value: FieldValue, props?: any) => any;

  showHelpInTooltip?: boolean;

  /**
   * Should show a "return key" icon in input?
   */
  showReturnButton?: boolean;

  stacked?: boolean;

  transformInput?: (value: FieldValue) => FieldValue;

  /** Does editing this field require the Form to load new configs? */
  updatesForm?: boolean;
  validate?: ({id: String, form: object}) => string[][];
  visible?: boolean | ((props: any) => boolean);
};

// TODO(ts): These are field specific props. May not be needed as we convert
// the fields as we can grab the props from them

type CustomType = {type: 'custom'} & {
  Component: (arg: BaseField) => React.ReactNode;
};

type InputType = {type: 'string' | 'secret'} & {
  autoComplete?: string;
};

type SelectControlType = {type: 'choice' | 'select'} & {
  allowClear?: boolean;
  // for new select
  defaultOptions?: Array<{label: string; value: any}> | boolean;
  filterOption?: ReturnType<typeof createFilter>;
  multiple?: boolean;
  noOptionsMessage?: () => string;
  options?: Array<{label: string; value: any}>;
};

type TextareaType = {type: 'textarea'} & {
  autosize?: boolean;
  rows?: number;
};

type RangeSliderProps = React.ComponentProps<typeof RangeSlider>;

type RangeType = {type: 'range'} & Omit<RangeSliderProps, 'value'> & {
    value?: Pick<RangeSliderProps, 'value'>;
  };

export type TableType = {
  /**
   * A list of column keys for the table, in the order that you want
   * the columns to appear - order doesn't matter in columnLabels
   */
  columnKeys: string[];
  /**
   * An object with of column labels (headers) for the table.
   */
  columnLabels: object;
  type: 'table';
  /**
   * The confirmation message before a a row is deleted
   */
  confirmDeleteMessage?: string;
  // TODO(TS): Should we have addButtonText and allowEmpty here as well?
};

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

export type SelectAsyncType = {
  type: 'select_async';
} & SelectAsyncFieldProps;

export type Field = (
  | CustomType
  | SelectControlType
  | InputType
  | TextareaType
  | RangeType
  | TableType
  | ProjectMapperType
  | SentryProjectSelectorType
  | SelectAsyncType
  | ChoiceMapperType
  | {type: typeof FieldType[number]}
) &
  BaseField;

export type FieldObject = Field | Function;

export type JsonFormObject = {
  fields: FieldObject[];
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
