import React from 'react';
import {createFilter} from 'react-select';

import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';
import Alert from 'app/components/alert';
import {AvatarProject, Project} from 'app/types';

export const FieldType = [
  'array',
  'bool',
  'boolean',
  'choice_mapper',
  'email',
  'hidden',
  'multichoice',
  'number',
  'radio',
  'rich_list',
  'secret',
  'separator',
  'string',
  'text',
  'url',
  'table',
  'project_mapper',
  'sentry_project_selector',
] as const;

export type FieldValue = any;

type ConfirmKeyType = 'true' | 'false';

// TODO(ts): A lot of these attributes are missing correct types. We'll likely
// need to introduce some generics in here to get rid of some of these anys.

type BaseField = {
  label?: React.ReactNode | (() => React.ReactNode);
  name: string;
  help?: React.ReactNode | ((props: any) => React.ReactNode);
  showHelpInTooltip?: boolean;
  required?: boolean;
  placeholder?: string | ((props: any) => React.ReactNode);
  multiline?: boolean;
  monospace?: boolean;
  visible?: boolean | ((props: any) => boolean);
  disabled?: boolean | ((props: any) => boolean);
  disabledReason?: string;
  defaultValue?: FieldValue;
  updatesForm?: boolean;
  confirm?: {[key in ConfirmKeyType]?: string};
  autosize?: boolean;
  maxRows?: number;
  extraHelp?: string;
  choices?:
    | ((props: {[key: string]: any}) => void)
    | readonly Readonly<[number | string, React.ReactNode]>[];

  formatLabel?: (value: number | '') => React.ReactNode;
  transformInput?: (value: FieldValue) => FieldValue;
  getData?: (data: object) => object;
  /**
   * If false, disable saveOnBlur for field, instead show a save/cancel button
   */
  saveOnBlur?: boolean;
  saveMessageAlertType?: React.ComponentProps<typeof Alert>['type'];
  saveMessage?: React.ReactNode | ((params: {value: FieldValue}) => string);
  /**
   * Function to format the value displayed in the undo toast. May also be
   * specified as false to disable showing the changed fields in the toast.
   */
  formatMessageValue?: Function | false;
  /**
   * Should show a "return key" icon in input?
   */
  showReturnButton?: boolean;
  getValue?: (value: FieldValue) => any;
  setValue?: (value: FieldValue, props?: any) => any;

  onChange?: (value: FieldValue) => void;

  validate?: ({id: String, form: object}) => string[][];

  // TODO(ts): FormField prop?
  inline?: boolean;

  // TODO(ts): used in sentryAppPublishRequestModal
  meta?: string;

  selectionInfoFunction?: (props: any) => React.ReactNode;

  stacked?: boolean;
  flexibleControlStateSize?: boolean;
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
  multiple?: boolean;

  options?: Array<{label: string; value: any}>; //for new select
  defaultOptions?: Array<{label: string; value: any}> | boolean;
  filterOption?: ReturnType<typeof createFilter>;
  noOptionsMessage?: () => string;
};

type TextareaType = {type: 'textarea'} & {
  autosize?: boolean;
  rows?: number;
};

type RangeType = {type: 'range'} & Omit<RangeSlider['props'], 'value'> & {
    value?: Pick<RangeSlider['props'], 'value'>;
  };

export type TableType = {
  type: 'table';
  /**
   * An object with of column labels (headers) for the table.
   */
  columnLabels: object;
  /**
   * A list of column keys for the table, in the order that you want
   * the columns to appear - order doesn't matter in columnLabels
   */
  columnKeys: string[];
  /**
   * The confirmation message before a a row is deleted
   */
  confirmDeleteMessage?: string;
  //TODO(TS): Should we have addButtonText and allowEmpty here as well?
};

//maps a sentry project to another field
export type ProjectMapperType = {
  type: 'project_mapper';
  mappedDropdown: {
    items: Array<{value: string | number; label: string; url: string}>;
    placeholder: string;
  };
  sentryProjects: Array<AvatarProject & {id: number; name: string}>;
  nextButton: {
    url: string | null;
    text: string;
  };
  iconType: string;
};

//selects a sentry project with avatars
export type SentryProjectSelectorType = {
  type: 'sentry_project_selector';
  projects: Project[];
  avatarSize?: number;
};

export type Field = (
  | CustomType
  | SelectControlType
  | InputType
  | TextareaType
  | RangeType
  | {type: typeof FieldType[number]}
  | TableType
  | ProjectMapperType
  | SentryProjectSelectorType
) &
  BaseField;

export type FieldObject = Field | Function;

export type JsonFormObject = {
  title?: React.ReactNode;
  fields: FieldObject[];
};
