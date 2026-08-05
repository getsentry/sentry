import {useMemo, useRef, useState, type ReactNode} from 'react';
import type {UseMutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {unreachable} from 'sentry/utils/unreachable';

import {
  ChoiceMapperDropdown,
  ChoiceMapperTable,
  getChoiceMapperRowNames,
} from './choiceMapperAdapter';
import {
  ProjectMapperAddRow,
  ProjectMapperNextButton,
  ProjectMapperTable,
} from './projectMapperAdapter';
import {TableBody, TableHeaderRow} from './tableAdapter';
import type {ChoiceMapperValue, FieldValue, JsonFormAdapterFieldConfig} from './types';
import {getDefaultForField, getDisabledProp, getZodType, transformChoices} from './utils';

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
  /**
   * choice_mapper rows tombstoned since the last successful save. A tombstone
   * lingers in the form value until the refetch lands, so we can't tell an
   * explicit removal from a leftover by looking at the submitted value alone.
   */
  const tombstonedKeysRef = useRef(new Set<string>());

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
                    disabled={!!getDisabledProp(field) || baseProps.disabled}
                  />
                </fieldApi.Layout.Row>
                <TableBody
                  config={field}
                  value={fieldApi.state.value}
                  onUpdate={fieldApi.handleChange}
                  onSave={() => baseProps.onBlur()}
                  disabled={!!getDisabledProp(field) || baseProps.disabled}
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
                    disabled={!!getDisabledProp(field) || baseProps.disabled}
                  />
                  <ProjectMapperAddRow
                    config={field}
                    value={fieldApi.state.value}
                    onAdd={handleChangeAndSave}
                    indicator={indicator}
                    disabled={!!getDisabledProp(field) || baseProps.disabled}
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
    const choiceValue = value as ChoiceMapperValue;
    // What the server currently holds — only these rows need a tombstone to be
    // deleted, and only their removal is worth confirming.
    const savedKeys = new Set(
      Object.keys(choiceValue).filter(key => choiceValue[key] !== null)
    );

    // A tombstone is only "pending" until the save it belongs to succeeds;
    // afterwards it may still ride along in the value as a harmless no-op.
    const onMutationSuccess: typeof mutationOptions.onSuccess = (...args) => {
      tombstonedKeysRef.current = new Set();
      return mutationOptions.onSuccess?.(...args);
    };

    const confirmRemovals = (submittedValue: ChoiceMapperValue) => {
      const removed = Object.keys(submittedValue).filter(
        key => submittedValue[key] === null && tombstonedKeysRef.current.has(key)
      );

      if (removed.length === 0) {
        // No confirmation — the save carries no explicit removal
        return;
      }

      const names = getChoiceMapperRowNames(field, labels, removed).join(', ');

      return removed.length === 1
        ? t("Remove the saved mapping for %s? This can't be undone.", names)
        : t("Remove the saved mappings for %s? This can't be undone.", names);
    };

    return (
      <AutoSaveForm
        name={fieldName}
        schema={schema}
        initialValue={value}
        mutationOptions={{...mutationOptions, onSuccess: onMutationSuccess}}
        confirm={field.supportsExplicitRemovals ? confirmRemovals : undefined}
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
                    disabled={!!getDisabledProp(field) || baseProps.disabled}
                    indicator={indicator}
                  />
                </fieldApi.Layout.Row>
                <ChoiceMapperTable
                  config={field}
                  value={fieldApi.state.value}
                  labels={labels}
                  savedKeys={savedKeys}
                  onTombstone={key => tombstonedKeysRef.current.add(key)}
                  onUpdate={fieldApi.handleChange}
                  onSave={() => baseProps.onBlur()}
                  disabled={!!getDisabledProp(field) || baseProps.disabled}
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
                  disabled={getDisabledProp(field)}
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
                  disabled={getDisabledProp(field)}
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
                  disabled={getDisabledProp(field)}
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
                  disabled={getDisabledProp(field)}
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
                  disabled={getDisabledProp(field)}
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
                  disabled={getDisabledProp(field)}
                  type={
                    field.type === 'string' || field.type === 'text' ? 'text' : field.type
                  }
                />
              </fieldApi.Layout.Row>
            );
          case 'blank':
            return null;
          default:
            unreachable(field);
            return null;
        }
      }}
    </AutoSaveForm>
  );
}
