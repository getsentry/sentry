import {useMemo} from 'react';
import type {UseMutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveField} from '@sentry/scraps/form';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import {ChoiceMapperDropdown, ChoiceMapperTable} from './choiceMapperAdapter';
import type {JsonFormAdapterFieldConfig} from './types';

function getZodType(fieldType: JsonFormAdapterFieldConfig['type']) {
  switch (fieldType) {
    case 'boolean':
      return z.boolean();
    case 'string':
    case 'text':
    case 'url':
    case 'email':
    case 'secret':
    case 'textarea':
      return z.string();
    case 'number':
      return z.number();
    case 'select':
    case 'choice':
      return z.any();
    default:
      return z.any();
  }
}

function transformChoices(
  choices?: Array<[value: string, label: string]>
): Array<{label: string; value: string}> {
  if (!choices) {
    return [];
  }
  return choices.map(([value, label]) => ({value, label}));
}

function getDefaultForType(field: JsonFormAdapterFieldConfig): unknown {
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
    case 'select':
    case 'choice':
      return null;
    default:
      return '';
  }
}

interface LegacyJsonFormAdapterProps<TData, TContext> {
  field: JsonFormAdapterFieldConfig;
  mutationOptions: UseMutationOptions<TData, Error, unknown, TContext>;
  initialValue?: unknown;
}

export function LegacyJsonFormAdapter<TData, TContext>({
  field,
  initialValue,
  mutationOptions,
}: LegacyJsonFormAdapterProps<TData, TContext>) {
  const fieldName = field.name;

  const schema = useMemo(
    () => z.object({[fieldName]: getZodType(field.type)}),
    [fieldName, field.type]
  );

  // Unsupported field types get a placeholder
  if (field.type === 'table' || field.type === 'project_mapper') {
    return (
      <Text variant="muted" as="p">
        {t('Field "%s" is not supported in auto-save mode.', field.label)}
      </Text>
    );
  }

  if (field.type === 'choice_mapper') {
    const choiceMapperSchema = z.object({
      [fieldName]: z.any(),
    });
    const choiceMapperValue = (
      initialValue !== undefined && initialValue !== null
        ? initialValue
        : field.default === undefined
          ? {}
          : field.default
    ) as Record<string, Record<string, unknown>>;

    return (
      <AutoSaveField
        name={fieldName}
        schema={choiceMapperSchema}
        initialValue={choiceMapperValue}
        mutationOptions={mutationOptions}
      >
        {fieldApi => (
          <fieldApi.Base>
            {(baseProps, {indicator}) => (
              <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                <ChoiceMapperDropdown
                  config={field}
                  value={fieldApi.state.value}
                  onChange={fieldApi.handleChange}
                  indicator={indicator}
                />
                <ChoiceMapperTable
                  config={field}
                  value={fieldApi.state.value}
                  onUpdate={fieldApi.handleChange}
                  onSave={() => baseProps.onBlur()}
                  disabled={field.disabled || baseProps.disabled}
                />
              </fieldApi.Layout.Row>
            )}
          </fieldApi.Base>
        )}
      </AutoSaveField>
    );
  }

  const value =
    initialValue !== undefined && initialValue !== null
      ? initialValue
      : field.default === undefined
        ? getDefaultForType(field)
        : field.default;

  return (
    <AutoSaveField
      name={fieldName}
      schema={schema}
      initialValue={value}
      mutationOptions={mutationOptions}
    >
      {fieldApi => {
        switch (field.type) {
          case 'boolean':
            return (
              <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                <fieldApi.Switch
                  checked={fieldApi.state.value}
                  onChange={fieldApi.handleChange}
                  disabled={field.disabled}
                />
              </fieldApi.Layout.Row>
            );
          case 'textarea':
            return (
              <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                <fieldApi.TextArea
                  value={fieldApi.state.value}
                  onChange={fieldApi.handleChange}
                  placeholder={field.placeholder}
                  disabled={field.disabled}
                />
              </fieldApi.Layout.Row>
            );
          case 'number':
            return (
              <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                <fieldApi.Number
                  value={fieldApi.state.value}
                  onChange={fieldApi.handleChange}
                  placeholder={field.placeholder}
                  disabled={field.disabled}
                />
              </fieldApi.Layout.Row>
            );
          case 'select':
          case 'choice':
            return (
              <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                <fieldApi.Select
                  value={fieldApi.state.value}
                  onChange={fieldApi.handleChange}
                  options={transformChoices(field.choices)}
                  disabled={field.disabled}
                />
              </fieldApi.Layout.Row>
            );
          case 'secret':
            return (
              <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                <fieldApi.Password
                  value={fieldApi.state.value}
                  onChange={fieldApi.handleChange}
                  placeholder={field.placeholder}
                  disabled={field.disabled}
                />
              </fieldApi.Layout.Row>
            );
          case 'string':
          case 'text':
          case 'url':
          case 'email':
          default:
            return (
              <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                <fieldApi.Input
                  value={fieldApi.state.value}
                  onChange={fieldApi.handleChange}
                  placeholder={field.placeholder}
                  disabled={field.disabled}
                />
              </fieldApi.Layout.Row>
            );
        }
      }}
    </AutoSaveField>
  );
}
