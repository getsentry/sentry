import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {queryOptions, type UseQueryOptions} from '@tanstack/react-query';
import {z} from 'zod';

import type {ButtonProps} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import type {SelectValue} from '@sentry/scraps/select';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {unreachable} from 'sentry/utils/unreachable';

import {ChoiceMapperDropdown, ChoiceMapperTable} from './choiceMapperAdapter';
import {ProjectMapperAddRow, ProjectMapperTable} from './projectMapperAdapter';
import {TableBody, TableHeaderRow} from './tableAdapter';
import type {JsonFormAdapterFieldConfig} from './types';
import {
  getDefaultForField,
  getDisabledProp,
  getReconciledFieldValue,
  getSubmitValues,
  transformChoices,
} from './utils';

/**
 * API client without base URL prefix, needed for async select fields
 * that use URLs like `/extensions/jira/search/...` or `/search`.
 */
const API_CLIENT = new Client({baseUrl: '', headers: {}});

type AsyncSelectQueryOptions = UseQueryOptions<
  Array<SelectValue<string>>,
  Error,
  Array<SelectValue<string>>,
  // The queryKey shape is dynamic across consumers (URL-based default vs.
  // customAsyncQueryOptions). TanStack's TQueryKey is contravariant inside
  // `enabled`, so anything narrower than `any` here breaks variance with
  // factories that build literal-tuple query keys.
  any
>;

type AsyncSelectQueryOptionsFactory = (debouncedInput: string) => AsyncSelectQueryOptions;

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
   * Override the built-in async query options for specific fields. Map from
   * field name to a factory that returns query options for a given search input.
   * When provided for a field, this is used instead of the default URL-based
   * async loading. Useful when the async endpoint requires a different query
   * shape than the built-in `buildAsyncSelectQuery`.
   */
  customAsyncQueryOptions?: Record<string, AsyncSelectQueryOptionsFactory>;
  /**
   * Disables all fields and the submit button.
   */
  disabled?: boolean;
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
   * `field.default`.
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
    options: Array<SelectValue<string>>
  ) => void;
  /**
   * Called when a field with `updatesForm: true` changes value.
   */
  onFieldChange?: (fieldName: string, value: unknown) => void;
  /**
   * Called whenever any field value changes.
   */
  onValueChange?: (fieldName: string, value: unknown) => void;
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
          if (
            (field.type === 'select' || field.type === 'choice') &&
            field.multiple &&
            Array.isArray(val)
          ) {
            return val.length > 0;
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
      const initialValue = initialValues?.[field.name];
      defaults[field.name] =
        initialValue === undefined
          ? (field.default ?? getDefaultForField(field))
          : initialValue;
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
  disabled,
  dynamicFieldValues,
  onAsyncOptionsFetched,
  onFieldChange,
  onValueChange,
  customAsyncQueryOptions,
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
        await onSubmit(getSubmitValues(fields, value));
      } catch (err) {
        if (err instanceof RequestError) {
          const response = err.responseJSON;
          const getFirstError = (errors: unknown) => {
            if (typeof errors === 'string') {
              return errors;
            }
            return Array.isArray(errors) && typeof errors[0] === 'string'
              ? errors[0]
              : undefined;
          };
          const nonFieldError = getFirstError(
            response?.non_field_errors ?? response?.nonFieldErrors
          );
          const fieldError = Object.entries(response ?? {}).find(
            ([key, errors]) =>
              key !== 'detail' &&
              key !== 'non_field_errors' &&
              key !== 'nonFieldErrors' &&
              getFirstError(errors)
          )?.[1];
          const detail = response?.detail;
          const message =
            nonFieldError ??
            (typeof detail === 'string' ? detail : detail?.message) ??
            getFirstError(fieldError);
          addErrorMessage(message ?? t('An error occurred while submitting'));
        }
      }
    },
  });

  // Reconcile form values after backend field config changes.
  useLayoutEffect(() => {
    for (const field of fields) {
      if (field.type === 'blank') {
        continue;
      }

      const currentValue = form.getFieldValue(field.name);
      const hasAsyncChoices =
        (field.type === 'select' || field.type === 'choice') &&
        (field.url || customAsyncQueryOptions?.[field.name]);
      const reconciledValue = getReconciledFieldValue(
        field,
        currentValue,
        defaultValues[field.name],
        {
          validateChoices: !hasAsyncChoices,
        }
      );
      if (!Object.is(reconciledValue, currentValue)) {
        form.setFieldValue(field.name, reconciledValue);
      }
    }
  }, [customAsyncQueryOptions, defaultValues, fields, form]);

  const hasErrors = fields.some(
    field => field.name === 'error' && field.type === 'blank'
  );

  const buttonDisabled = hasErrors || !!submitDisabled || !!isLoading || !!disabled;

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
                  const disabledProp = getDisabledProp(field, disabled);
                  const handleChange = (value: unknown) => {
                    fieldApi.handleChange(value);
                    onValueChange?.(field.name, value);
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
                            disabled={disabledProp}
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
                            autosize={field.autosize ?? true}
                            maxRows={field.maxRows}
                            value={(fieldApi.state.value as string) ?? ''}
                            onChange={handleChange}
                            placeholder={field.placeholder}
                            disabled={disabledProp}
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
                            disabled={disabledProp}
                          />
                        </fieldApi.Layout.Stack>
                      );
                    case 'select':
                    case 'choice': {
                      if (field.url || customAsyncQueryOptions?.[field.name]) {
                        // Async select: fetch options from URL as user types.
                        // Show static choices as initial options before any search.
                        const staticOptions = transformChoices(field.choices);
                        const customQueryOptions = customAsyncQueryOptions?.[field.name];
                        const defaultAsyncQueryOptions = ((debouncedInput: string) =>
                          queryOptions({
                            queryKey: [
                              'backend-json-async-select',
                              field.name,
                              field.url,
                              debouncedInput,
                              dynamicFieldValues,
                              JSON.stringify(onAsyncOptionsFetchedRef),
                            ],
                            queryFn: async (): Promise<Array<SelectValue<string>>> => {
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
                          })) satisfies AsyncSelectQueryOptionsFactory;
                        const asyncQueryOptions =
                          customQueryOptions ?? defaultAsyncQueryOptions;
                        if (field.multiple) {
                          return (
                            <fieldApi.Layout.Stack
                              label={field.label}
                              hintText={field.help}
                              required={field.required}
                            >
                              <fieldApi.SelectAsync
                                multiple
                                value={
                                  (fieldApi.state.value as Array<string | number>) ?? []
                                }
                                onChange={(value: Array<string | number>) =>
                                  handleChange(value)
                                }
                                disabled={disabledProp}
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
                            {field.required ? (
                              <fieldApi.SelectAsync
                                value={(fieldApi.state.value ?? null) as string | null}
                                onChange={(value: string) => handleChange(value)}
                                disabled={disabledProp}
                                queryOptions={asyncQueryOptions}
                              />
                            ) : (
                              <fieldApi.SelectAsync
                                clearable
                                value={(fieldApi.state.value ?? null) as string | null}
                                onChange={(value: string | null) => handleChange(value)}
                                disabled={disabledProp}
                                queryOptions={asyncQueryOptions}
                              />
                            )}
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
                              onChange={(value: string[]) => handleChange(value)}
                              options={transformChoices(field.choices)}
                              disabled={disabledProp}
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
                          {field.required ? (
                            <fieldApi.Select
                              value={(fieldApi.state.value ?? null) as string | null}
                              onChange={(value: string) => handleChange(value)}
                              options={transformChoices(field.choices)}
                              disabled={disabledProp}
                            />
                          ) : (
                            <fieldApi.Select
                              clearable
                              value={(fieldApi.state.value ?? null) as string | null}
                              onChange={(value: string | null) => handleChange(value)}
                              options={transformChoices(field.choices)}
                              disabled={disabledProp}
                            />
                          )}
                        </fieldApi.Layout.Stack>
                      );
                    }
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
                            disabled={disabledProp}
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
                            disabled={disabledProp}
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
                              disabled={!!disabledProp}
                            />
                          </fieldApi.Layout.Row>
                          <TableBody
                            config={field}
                            value={tableValue}
                            onUpdate={handleChange}
                            onSave={() => {}}
                            disabled={!!disabledProp}
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
                            disabled={!!disabledProp}
                          />
                          <ProjectMapperAddRow
                            config={field}
                            value={mapperValue}
                            onAdd={handleChange}
                            disabled={!!disabledProp}
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
                              disabled={!!disabledProp}
                            />
                          </fieldApi.Layout.Row>
                          <ChoiceMapperTable
                            config={field}
                            value={choiceValue}
                            labels={fieldLabels}
                            onUpdate={handleChange}
                            onSave={() => {}}
                            disabled={!!disabledProp}
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
