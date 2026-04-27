import {useMemo, useState, type ReactNode} from 'react';
import type {UseMutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {ChoiceMapperDropdown, ChoiceMapperTable} from './choiceMapperAdapter';
import {BackendJsonFieldFromConfig} from './fieldFromConfig';
import {
  ProjectMapperAddRow,
  ProjectMapperNextButton,
  ProjectMapperTable,
} from './projectMapperAdapter';
import {TableBody, TableHeaderRow} from './tableAdapter';
import type {FieldValue, JsonFormAdapterFieldConfig} from './types';
import {getDefaultForField, getZodType} from './utils';

interface BackendJsonFormAdapterProps<
  TField extends JsonFormAdapterFieldConfig,
  TData,
  TContext,
> {
  field: TField;
  mutationOptions: UseMutationOptions<TData, Error, Record<string, unknown>, TContext>;
  initialValue?: FieldValue<TField>;
}

export function BackendJsonAutoSaveForm<
  TField extends JsonFormAdapterFieldConfig,
  TData,
  TContext,
>({
  field,
  initialValue,
  mutationOptions,
}: BackendJsonFormAdapterProps<TField, TData, TContext>) {
  const fieldName = field.name;
  const [labels, setLabels] = useState<Record<string, ReactNode>>({});

  const schema = useMemo(
    () => z.object({[fieldName]: getZodType(field.type)}),
    [fieldName, field.type]
  );

  const value = initialValue ?? field.default ?? getDefaultForField(field);

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
                  <ProjectMapperNextButton config={field} value={fieldApi.state.value} />
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
                    onLabelAdd={(key, label) => {
                      setLabels(prev => ({...prev, [key]: label}));
                    }}
                    onChange={fieldApi.handleChange}
                    disabled={field.disabled || baseProps.disabled}
                    indicator={indicator}
                  />
                </fieldApi.Layout.Row>
                <ChoiceMapperTable
                  config={field}
                  value={fieldApi.state.value}
                  labels={labels}
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
        if (field.type === 'blank') {
          return null;
        }
        // Composite cases above already returned. The remaining types are all
        // simple "label + control" — delegate the control to the shared renderer.
        return (
          <fieldApi.Layout.Row label={field.label} hintText={field.help}>
            <BackendJsonFieldFromConfig
              field={field}
              fieldApi={fieldApi}
              value={fieldApi.state.value}
              onChange={fieldApi.handleChange}
            />
          </fieldApi.Layout.Row>
        );
      }}
    </AutoSaveForm>
  );
}
