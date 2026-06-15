import {z} from 'zod';

import {unreachable} from 'sentry/utils/unreachable';

import type {JsonFormAdapterFieldConfig} from './types';

export function getZodType(fieldType: JsonFormAdapterFieldConfig['type']) {
  switch (fieldType) {
    case 'boolean':
      return z.boolean();
    case 'string':
    case 'text':
    case 'secret':
    case 'textarea':
      return z.string();
    case 'number':
      return z.number();
    case 'email':
      return z.email();
    case 'url':
      return z.url();
    case 'choice_mapper':
      return z.looseObject({});
    case 'project_mapper':
    case 'table':
      return z.array(z.any());
    case 'select':
    case 'choice':
      return z.any();
    case 'blank':
      return z.any();
    default:
      unreachable(fieldType);
      return z.any();
  }
}

export function transformChoices(
  choices?: Array<[value: string, label: string]>
): Array<{label: string; value: string}> {
  if (!choices) {
    return [];
  }
  return choices.map(([value, label]) => ({value, label}));
}

export function getDisabledProp(
  field: JsonFormAdapterFieldConfig,
  forceDisabled?: boolean
): boolean | string {
  if (forceDisabled) {
    return true;
  }
  if (field.disabled && field.disabledReason) {
    return field.disabledReason;
  }
  return field.disabled ?? false;
}

/** Removes values for fields no longer present in the backend config. */
export function getSubmitValues(
  fields: JsonFormAdapterFieldConfig[],
  values: Record<string, unknown>
): Record<string, unknown> {
  const submitValues: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type !== 'blank' && Object.hasOwn(values, field.name)) {
      submitValues[field.name] = values[field.name];
    }
  }
  return submitValues;
}

/** Returns true when a config update should reset a field to its default. */
export function shouldUseFieldDefault(
  field: JsonFormAdapterFieldConfig,
  value: unknown,
  options: {validateChoices?: boolean} = {}
): boolean {
  if (value === undefined) {
    return true;
  }
  if (options.validateChoices === false) {
    return false;
  }
  if ((field.type !== 'select' && field.type !== 'choice') || !field.choices?.length) {
    return false;
  }

  const choiceValues = new Set(field.choices.map(([choiceValue]) => String(choiceValue)));
  const hasChoice = (item: unknown) => {
    if (
      typeof item !== 'string' &&
      typeof item !== 'number' &&
      typeof item !== 'boolean'
    ) {
      return false;
    }
    return choiceValues.has(String(item));
  };

  if (field.multiple) {
    return !Array.isArray(value) || value.some(item => !hasChoice(item));
  }

  return value !== null && !hasChoice(value);
}

export function getDefaultForField(field: JsonFormAdapterFieldConfig): unknown {
  switch (field.type) {
    case 'boolean':
      return false;
    case 'string':
    case 'text':
    case 'url':
    case 'email':
    case 'secret':
    case 'textarea':
      return '';
    case 'number':
      return 0;
    case 'choice_mapper':
      return {};
    case 'project_mapper':
    case 'table':
      return [];
    case 'select':
    case 'choice':
      return field.multiple ? [] : null;
    case 'blank':
      return null;
    default:
      unreachable(field);
      return '';
  }
}
