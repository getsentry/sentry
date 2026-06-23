import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import type {TicketActionData} from 'sentry/types/alerts';
import type {Choices} from 'sentry/types/core';
import type {IssueConfigField} from 'sentry/types/integrations';

export const STATIC_TICKET_FIELDS: JsonFormAdapterFieldConfig[] = [
  {
    name: 'title',
    label: 'Title',
    type: 'string',
    default: 'This will be the same as the Sentry Issue.',
    disabled: true,
  },
  {
    name: 'description',
    label: 'Description',
    type: 'string',
    default: 'This will be generated from the Sentry Issue details.',
    disabled: true,
  },
];

function isSelectField(
  field: JsonFormAdapterFieldConfig
): field is Extract<JsonFormAdapterFieldConfig, {type: 'select' | 'choice'}> {
  return field.type === 'select' || field.type === 'choice';
}

function isAsyncSelectField(field: JsonFormAdapterFieldConfig): field is Extract<
  JsonFormAdapterFieldConfig,
  {type: 'select' | 'choice'}
> & {
  url: string;
} {
  return isSelectField(field) && Boolean(field.url);
}

export function getSavedChoicesMap(instance: TicketActionData) {
  const savedFields = Object.values(instance?.dynamic_form_fields || {});

  return new Map(
    savedFields
      .filter(
        (field): field is IssueConfigField =>
          typeof field === 'object' &&
          field !== null &&
          'url' in field &&
          'choices' in field &&
          Array.isArray(field.choices) &&
          field.choices.length > 0
      )
      .map(field => [field.name, field.choices as Choices])
  );
}

function getSavedDefaultValue(field: JsonFormAdapterFieldConfig, savedValue: unknown) {
  if (!savedValue) {
    return null;
  }

  if (!isSelectField(field) || isAsyncSelectField(field)) {
    return savedValue;
  }

  const choices = field.choices || [];

  if (Array.isArray(savedValue)) {
    const availableValues = savedValue.filter(value =>
      choices.some(([choiceValue]) => choiceValue === value)
    );
    return availableValues.length > 0 ? availableValues : null;
  }

  return choices.some(([choiceValue]) => choiceValue === savedValue) ? savedValue : null;
}

function withFieldDefault(
  field: JsonFormAdapterFieldConfig,
  defaultValue: unknown
): JsonFormAdapterFieldConfig {
  return {...field, default: defaultValue} as JsonFormAdapterFieldConfig;
}

export function applySavedDefaultToField({
  field,
  savedValue,
  savedChoicesMap,
}: {
  field: JsonFormAdapterFieldConfig;
  savedChoicesMap: Map<string, Choices>;
  savedValue: unknown;
}): JsonFormAdapterFieldConfig {
  const defaultValue = getSavedDefaultValue(field, savedValue);

  if (defaultValue === null) {
    return field;
  }

  const savedChoices = savedChoicesMap.get(field.name);
  if (savedChoices && isAsyncSelectField(field)) {
    return withFieldDefault(
      {...field, choices: savedChoices as Array<[string, string]>},
      defaultValue
    );
  }

  return withFieldDefault(field, defaultValue);
}
