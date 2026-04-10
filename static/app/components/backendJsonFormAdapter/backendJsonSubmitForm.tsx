import {useMemo, useRef, useState, type ReactNode, useEffect} from 'react';
import {queryOptions} from '@tanstack/react-query';
import {z} from 'zod';

import type {ButtonProps} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {unreachable} from 'sentry/utils/unreachable';

import {ChoiceMapperDropdown, ChoiceMapperTable} from './choiceMapperAdapter';
import {ProjectMapperAddRow, ProjectMapperTable} from './projectMapperAdapter';
import {TableBody, TableHeaderRow} from './tableAdapter';
import type {JsonFormAdapterFieldConfig} from './types';
import {getDefaultForField, transformChoices} from './utils';

/**
 * API client without base URL prefix, needed for async select fields
 * that use URLs like `/extensions/jira/search/...` or `/search`.
 */
const API_CLIENT = new Client({baseUrl: '', headers: {}});

interface BackendJsonSubmitFormProps {
  /**
   * Field configs from the backend API response.
   */
  fields: JsonFormAdapterFieldConfig[];
  /**
   * Called when the form is submitted. Should return a promise that
   * resolves on success or rejects/throws on error.
   */
  onSubmit: (values: Record<string, unknown>) => Promise<unknown> | void;
  /**
   * Current values of dynamic fields, passed as query params to async select endpoints.
   */
  dynamicFieldValues?: Record<string, unknown>;
  /**
   * Render prop for the submit button area. Receives the disabled state and the
   * SubmitButton component. Use this to place the button in a custom location
   * (e.g., a modal footer). If not provided, the submit button renders inline.
   */
  footer?: (props: {
    SubmitButton: React.ComponentType<ButtonProps>;
    disabled: boolean;
  }) => React.ReactNode;
  /**
   * Override default values for specific fields. Takes precedence over
   * `field.default`. Useful for preserving dynamic field selections
   * across form remounts.
   */
  initialValues?: Record<string, unknown>;
  /**
   * Whether the form is in a loading state (e.g., dynamic field refetch in progress).
   */
  isLoading?: boolean;
  /**
   * Called when async select options are fetched for a field. Use this to
   * track fetched choices externally (e.g., for persisting them on submit).
   */
  onAsyncOptionsFetched?: (
    fieldName: string,
    options: Array<SelectValue<string | number>>
  ) => void;
  /**
   * Called when a field with `updatesForm: true` changes value.
   */
  onFieldChange?: (fieldName: string, value: unknown) => void;
  /**
   * Whether the submit button should be disabled (e.g., form has errors).
   */
  submitDisabled?: boolean;
  /**
   * Label for the submit button.
   */
  submitLabel?: string;
}

/**
 * Build a Zod schema that validates required fields are non-empty.
 */
function buildValidationSchema(fields: JsonFormAdapterFieldConfig[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.type === 'blank') {
      continue;
    }
    if (field.required) {
      shape[field.name] = z.any().refine(
        val => {
          if (val === null || val === undefined) {
            return false;
          }
          if (typeof val === 'string') {
            return val.trim() !== '';
          }
          return true;
        },
        {message: t('This field is required')}
      );
    }
  }
  return z.object(shape).passthrough();
}

function computeDefaultValues(
  fields: JsonFormAdapterFieldConfig[],
  initialValues?: Record<string, unknown>
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.name && field.type !== 'blank') {
      defaults[field.name] =
        initialValues?.[field.name] ?? field.default ?? getDefaultForField(field);
    }
  }
  return defaults;
}

function buildAsyncSelectQuery(
  fieldName: string,
  query: string,
  dynamicFieldValues?: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...dynamicFieldValues,
    field: fieldName,
    query,
  };
}

/**
 * A multi-field form that renders backend-driven field configs with a submit button.
 * Unlike `BackendJsonFormAdapter` (which is per-field auto-save), this component
 * renders all fields in a single form and submits them together.
 *
 * Supports:
 * - Static select fields (from `field.choices`)
 * - Async select fields (from `field.url` with debounced search)
 * - Dynamic field refetching (via `onFieldChange` for `updatesForm` fields)
 * - Text, textarea, number, boolean, and other basic field types
 */
export function BackendJsonSubmitForm({
  fields,
  onSubmit,
  submitLabel,
  submitDisabled,
  initialValues,
  isLoading,
  dynamicFieldValues,
  onAsyncOptionsFetched,
  onFieldChange,
  footer,
}: BackendJsonSubmitFormProps) {
  // Ref to avoid including the callback in queryKey (would cause refetches)
  const onAsyncOptionsFetchedRef = useRef(onAsyncOptionsFetched);
  useEffect(() => {
    onAsyncOptionsFetchedRef.current = onAsyncOptionsFetched;
  });

  // Labels for choice_mapper rows (maps key to display label)
  const [choiceMapperLabels, setChoiceMapperLabels] = useState<
    Record<string, Record<string, ReactNode>>
  >({});

  const defaultValues = useMemo(
    () => computeDefaultValues(fields, initialValues),
    [fields, initialValues]
  );

  const validationSchema = useMemo(() => buildValidationSchema(fields), [fields]);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {
      onSubmit: validationSchema,
    },
    onSubmit: async ({value}) => {
      try {
        await onSubmit(value);
      } catch (err) {
        if (err instanceof RequestError) {
          const detail = err.responseJSON?.detail;
          const message = typeof detail === 'string' ? detail : detail?.message;
          addErrorMessage(message ?? t('An error occurred while submitting'));
        }
      }
    },
  });

  const hasErrors = fields.some(
    field => field.name === 'error' && field.type === 'blank'
  );

  const buttonDisabled = hasErrors || !!submitDisabled || !!isLoading;

  const submitButton = footer ? (
    footer({SubmitButton: form.SubmitButton, disabled: buttonDisabled})
  ) : (
    <form.SubmitButton disabled={buttonDisabled}>{submitLabel}</form.SubmitButton>
  );

  return (
    <form.AppForm form={form}>
      {isLoading && <LoadingIndicator />}
      {!isLoading && (
        <Stack gap="xl">
          {fields
            .filter(field => field.type !== 'blank')
            .map(field => (
              <form.AppField key={field.name} name={field.name}>
                {fieldApi => {
                  const handleChange = (value: unknown) => {
                    fieldApi.handleChange(value);
                    if (field.updatesForm && onFieldChange) {
                      onFieldChange(field.name, value);
                    }
                  };

                  switch (field.type) {
                    case 'boolean':
                      return (
                        <fieldApi.Layout.Stack
                          label={field.label}
                          hintText={field.help}
                          required={field.required}
                        >
                          <fieldApi.Switch
                            checked={fieldApi.state.value as boolean}
                            onChange={handleChange}
                            disabled={field.disabled}
                          />
                        </fieldApi.Layout.Stack>
                      );
                    case 'textarea':
                      return (
                        <fieldApi.Layout.Stack
                          label={field.label}
                          hintText={field.help}
                          required={field.required}
                        >
                          <fieldApi.TextArea
                            autosize
                            value={(fieldApi.state.value as string) ?? ''}
                            onChange={handleChange}
                            placeholder={field.placeholder}
                            disabled={field.disabled}
                          />
                        </fieldApi.Layout.Stack>
                      );
                    case 'number':
                      return (
                        <fieldApi.Layout.Stack
                          label={field.label}
                          hintText={field.help}
                          required={field.required}
                        >
                          <fieldApi.Number
                            value={fieldApi.state.value as number}
                            onChange={handleChange}
                            placeholder={field.placeholder}
                            disabled={field.disabled}
                          />
                        </fieldApi.Layout.Stack>
                      );
                    case 'select':
                    case 'choice':
                      if (field.url) {
                        // Async select: fetch options from URL as user types.
                        // Show static choices as initial options before any search.
                        const staticOptions = transformChoices(field.choices);
                        const asyncQueryOptions = (debouncedInput: string) =>
                          queryOptions({
                            queryKey: [
                              'backend-json-async-select',
                              field.name,
                              field.url,
                              debouncedInput,
                              dynamicFieldValues,
                              JSON.stringify(onAsyncOptionsFetchedRef),
                            ],
                            queryFn: async (): Promise<
                              Array<SelectValue<string | number>>
                            > => {
                              if (!debouncedInput) {
                                return staticOptions;
                              }
                              const response = await API_CLIENT.requestPromise(
                                field.url!,
                                {
                                  query: buildAsyncSelectQuery(
                                    field.name,
                                    debouncedInput,
                                    dynamicFieldValues
                                  ),
                                }
                              );
                              // API may return non-array responses (e.g. error objects)
                              const results = Array.isArray(response) ? response : [];
                              if (results.length > 0) {
                                onAsyncOptionsFetchedRef.current?.(field.name, results);
                              }
                              return results;
                            },
                          });
                        if (field.multiple) {
                          return (
                            <fieldApi.Layout.Stack
                              label={field.label}
                              hintText={field.help}
                              required={field.required}
                            >
                              <fieldApi.SelectAsync
                                multiple
                                value={(fieldApi.state.value as string[]) ?? []}
                                onChange={handleChange}
                                disabled={field.disabled}
                                queryOptions={asyncQueryOptions}
                              />
                            </fieldApi.Layout.Stack>
                          );
                        }
                        return (
                          <fieldApi.Layout.Stack
                            label={field.label}
                            hintText={field.help}
                            required={field.required}
                          >
                            <fieldApi.SelectAsync
                              value={fieldApi.state.value as string | null}
                              onChange={handleChange}
                              disabled={field.disabled}
                              queryOptions={asyncQueryOptions}
                            />
                          </fieldApi.Layout.Stack>
                        );
                      }
                      if (field.multiple) {
                        return (
                          <fieldApi.Layout.Stack
                            label={field.label}
                            hintText={field.help}
                            required={field.required}
                          >
                            <fieldApi.Select
                              multiple
                              value={(fieldApi.state.value as string[]) ?? []}
                              onChange={handleChange}
                              options={transformChoices(field.choices)}
                              disabled={field.disabled}
                            />
                          </fieldApi.Layout.Stack>
                        );
                      }
                      return (
                        <fieldApi.Layout.Stack
                          label={field.label}
                          hintText={field.help}
                          required={field.required}
                        >
                          <fieldApi.Select
                            value={fieldApi.state.value as string | null}
                            onChange={handleChange}
                            options={transformChoices(field.choices)}
                            disabled={field.disabled}
                          />
                        </fieldApi.Layout.Stack>
                      );
                    case 'secret':
                      return (
                        <fieldApi.Layout.Stack
                          label={field.label}
                          hintText={field.help}
                          required={field.required}
                        >
                          <fieldApi.Password
                            value={(fieldApi.state.value as string) ?? ''}
                            onChange={handleChange}
                            placeholder={field.placeholder}
                            disabled={field.disabled}
                          />
                        </fieldApi.Layout.Stack>
                      );
                    case 'string':
                    case 'text':
                    case 'url':
                    case 'email':
                      return (
                        <fieldApi.Layout.Stack
                          label={field.label}
                          hintText={field.help}
                          required={field.required}
                        >
                          <fieldApi.Input
                            value={(fieldApi.state.value as string) ?? ''}
                            onChange={handleChange}
                            placeholder={field.placeholder}
                            disabled={field.disabled}
                            type={
                              field.type === 'string' || field.type === 'text'
                                ? 'text'
                                : field.type
                            }
                          />
                        </fieldApi.Layout.Stack>
                      );
                    case 'table': {
                      const tableValue = fieldApi.state.value as Array<
                        Record<string, unknown>
                      >;
                      return (
                        <Stack flexGrow={1} gap="xl">
                          <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                            <TableHeaderRow
                              config={field}
                              value={tableValue}
                              onAdd={handleChange}
                              disabled={field.disabled}
                            />
                          </fieldApi.Layout.Row>
                          <TableBody
                            config={field}
                            value={tableValue}
                            onUpdate={handleChange}
                            onSave={() => {}}
                            disabled={field.disabled}
                          />
                        </Stack>
                      );
                    }
                    case 'project_mapper': {
                      const mapperValue = fieldApi.state.value as Array<[number, string]>;
                      return (
                        <Stack flexGrow={1} gap="xl">
                          <ProjectMapperTable
                            config={field}
                            value={mapperValue}
                            onDelete={handleChange}
                            disabled={field.disabled}
                          />
                          <ProjectMapperAddRow
                            config={field}
                            value={mapperValue}
                            onAdd={handleChange}
                            disabled={field.disabled}
                          />
                        </Stack>
                      );
                    }
                    case 'choice_mapper': {
                      const choiceValue = fieldApi.state.value as Record<
                        string,
                        Record<string, unknown>
                      >;
                      const fieldLabels = choiceMapperLabels[field.name] ?? {};
                      return (
                        <Stack flexGrow={1} gap="xl">
                          <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                            <ChoiceMapperDropdown
                              config={field}
                              value={choiceValue}
                              onLabelAdd={(key, label) => {
                                setChoiceMapperLabels(prev => ({
                                  ...prev,
                                  [field.name]: {
                                    ...prev[field.name],
                                    [key]: label,
                                  },
                                }));
                              }}
                              onChange={handleChange}
                              disabled={field.disabled}
                            />
                          </fieldApi.Layout.Row>
                          <ChoiceMapperTable
                            config={field}
                            value={choiceValue}
                            labels={fieldLabels}
                            onUpdate={handleChange}
                            onSave={() => {}}
                            disabled={field.disabled}
                          />
                        </Stack>
                      );
                    }
                    default:
                      unreachable(field);
                      return null;
                  }
                }}
              </form.AppField>
            ))}
        </Stack>
      )}
      {submitButton}
    </form.AppForm>
  );
}
