import {useMemo} from 'react';
import type {UseMutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {unreachable} from 'sentry/utils/unreachable';

import {ChoiceMapperDropdown, ChoiceMapperTable} from './choiceMapperAdapter';
import {ProjectMapperAddRow, ProjectMapperTable} from './projectMapperAdapter';
import {TableBody, TableHeaderRow} from './tableAdapter';
import type {FieldValue, JsonFormAdapterFieldConfig} from './types';

function getZodType(
  fieldType: JsonFormAdapterFieldConfig['type'],
  fieldName: JsonFormAdapterFieldConfig['name']
) {
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
    case 'choice_mapper':
    case 'project_mapper':
      return z.object({
        [fieldName]: z.any(),
      });
    case 'table':
      return z.array(z.any());
    case 'select':
    case 'choice':
      return z.any();
    default:
      unreachable(fieldType);
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

function getDefaultForType(fieldType: JsonFormAdapterFieldConfig['type']): unknown {
  switch (fieldType) {
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
    case 'project_mapper':
      return {};
    case 'table':
      return [];
    case 'select':
    case 'choice':
      return null;
    default:
      unreachable(fieldType);
      return '';
  }
}

interface BackendJsonFormAdapterProps<
  TField extends JsonFormAdapterFieldConfig,
  TData,
  TContext,
> {
  field: TField;
  mutationOptions: UseMutationOptions<TData, Error, Record<string, unknown>, TContext>;
  initialValue?: FieldValue<TField>;
}

export function BackendJsonFormAdapter<
  TField extends JsonFormAdapterFieldConfig,
  TData,
  TContext,
>({
  field,
  initialValue,
  mutationOptions,
}: BackendJsonFormAdapterProps<TField, TData, TContext>) {
  const fieldName = field.name;

  const schema = useMemo(
    () => z.object({[fieldName]: getZodType(field.type, fieldName)}),
    [fieldName, field.type]
  );

  const value = initialValue ?? field.default ?? getDefaultForType(field.type);

  if (field.type === 'table') {
    return (
      <AutoSaveForm
        name={fieldName}
        schema={schema}
        initialValue={value}
        mutationOptions={mutationOptions}
      >
        {fieldApi => (
          <fieldApi.Base>
            {(baseProps, {indicator}) => (
              <Stack flexGrow={1} gap="xl">
                <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                  <TableHeaderRow
                    config={field}
                    value={fieldApi.state.value}
                    onAdd={newValue => {
                      fieldApi.handleChange(newValue);
                    }}
                    indicator={indicator}
                    disabled={field.disabled || baseProps.disabled}
                  />
                </fieldApi.Layout.Row>
                <TableBody
                  config={field}
                  value={fieldApi.state.value}
                  onUpdate={fieldApi.handleChange}
                  onSave={() => baseProps.onBlur()}
                  disabled={field.disabled || baseProps.disabled}
                />
              </Stack>
            )}
          </fieldApi.Base>
        )}
      </AutoSaveForm>
    );
  }

  if (field.type === 'project_mapper') {
    return (
      <AutoSaveForm
        name={fieldName}
        schema={schema}
        initialValue={value}
        mutationOptions={mutationOptions}
      >
        {fieldApi => (
          <fieldApi.Base>
            {(baseProps, {indicator}) => {
              const handleChangeAndSave = (newValue: Array<[number, string]>) => {
                fieldApi.handleChange(newValue);
                baseProps.onBlur();
              };
              return (
                <Stack flexGrow={1} gap="xl">
                  <ProjectMapperTable
                    config={field}
                    value={fieldApi.state.value}
                    onDelete={handleChangeAndSave}
                    disabled={field.disabled || baseProps.disabled}
                  />
                  <ProjectMapperAddRow
                    config={field}
                    value={fieldApi.state.value}
                    onAdd={handleChangeAndSave}
                    indicator={indicator}
                    disabled={field.disabled || baseProps.disabled}
                  />
                </Stack>
              );
            }}
          </fieldApi.Base>
        )}
      </AutoSaveForm>
    );
  }

  if (field.type === 'choice_mapper') {
    return (
      <AutoSaveForm
        name={fieldName}
        schema={schema}
        initialValue={value}
        mutationOptions={mutationOptions}
      >
        {fieldApi => (
          <fieldApi.Base>
            {(baseProps, {indicator}) => (
              <Stack flexGrow={1} gap="xl">
                <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                  <ChoiceMapperDropdown
                    config={field}
                    value={fieldApi.state.value}
                    onChange={fieldApi.handleChange}
                    indicator={indicator}
                  />
                </fieldApi.Layout.Row>
                <ChoiceMapperTable
                  config={field}
                  value={fieldApi.state.value}
                  onUpdate={fieldApi.handleChange}
                  onSave={() => baseProps.onBlur()}
                  disabled={field.disabled || baseProps.disabled}
                />
              </Stack>
            )}
          </fieldApi.Base>
        )}
      </AutoSaveForm>
    );
  }

  return (
    <AutoSaveForm
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
          default:
            unreachable(field);
            return null;
        }
      }}
    </AutoSaveForm>
  );
}
