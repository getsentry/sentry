import React from 'react';

import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';

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
] as const;

export type FieldValue = any;

type BaseField = {
  label?: React.ReactNode | (() => React.ReactNode);
  name?: string;
  help?: React.ReactNode | (() => React.ReactNode);
  required?: boolean;
  placeholder?: string | (() => string);
  multiline?: boolean;
  visible?: boolean | ((props: any) => boolean);
  disabled?: boolean | (() => boolean);
  disabledReason?: string;
  defaultValue?: FieldValue;

  /**
   * Function to format the value displayed in the undo toast. May also be
   * specified as false to disable showing the changed fields in the toast.
   */
  formatMessageValue?: Function | false;

  /**
   * Should show a "return key" icon in input?
   */
  showReturnButton?: boolean;

  /**
   * Iff false, disable saveOnBlur for field, instead show a save/cancel button
   */
  saveOnBlur?: boolean;
  getValue?: (value: FieldValue) => any;
  setValue?: (value: FieldValue) => any;

  onChange?: (value: FieldValue) => void;

  // TODO(ts): FormField prop?
  inline?: boolean;

  // TODO(ts): used in sentryAppPublishRequestModal
  meta?: string;
};

type CustomType = {type: 'custom'} & {
  Component: (arg: BaseField) => React.ReactNode;
};

// TODO(ts): These are field specific props
// May not be needed as we convert the fields
type SelectControlType = {type: 'choice' | 'select'} & {
  choices: [number | string, number | string][];
  multiple?: boolean;
};

type TextareaType = {type: 'textarea'} & {
  autosize?: boolean;
  rows?: number;
};

type RangeType = {type: 'range'} & Omit<RangeSlider['props'], 'value'> & {
    value?: Pick<RangeSlider['props'], 'value'>;
  };

export type Field = (
  | CustomType
  | SelectControlType
  | TextareaType
  | RangeType
  | {type: typeof FieldType[number]}) &
  BaseField;

export type FieldObject = Field | Function;

export type JsonFormObject = {
  title?: string;
  fields: FieldObject[];
};
