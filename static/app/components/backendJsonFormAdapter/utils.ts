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
      return z.object({});
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
