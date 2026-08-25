import {useId, useRef} from 'react';
// eslint-disable-next-line no-restricted-imports
import type {
  DeepKeys,
  DeepValue,
  OnSubmitError,
  ReactFormFieldProps,
  ToFormErrorTypes,
} from '@tanstack/react-form';
import {useMutation, type UseMutationOptions} from '@tanstack/react-query';
import {type z} from 'zod';

import {AutoSaveContextProvider} from '@sentry/scraps/form/autoSaveContext';
import {
  toFieldErrors,
  useScrapsForm,
  type BoundFieldComponents,
} from '@sentry/scraps/form/scrapsForm';
import {useTranslation} from '@sentry/scraps/translationContext';

import {openConfirmModal} from 'sentry/components/confirm';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';

/**
 * Configuration for confirmation dialogs before applying changes.
 * Used for dangerous operations like security settings.
 * Always focuses the Cancel button for safety.
 *
 * @example
 * // Simple string - always show this message
 * confirm="Are you sure you want to save?"
 *
 * @example
 * // Function - return message based on new value, or undefined to skip
 * confirm={(value) => value ? "Enable this feature?" : "Disable this feature?"}
 */
type ConfirmConfig<TValue = unknown> =
  | React.ReactNode
  | ((value: TValue) => React.ReactNode | undefined);

type SchemaInput<TSchema extends z.ZodObject> = z.input<TSchema>;
type SchemaOutput<TSchema extends z.ZodObject> = z.output<TSchema>;

/** Form data type coming from the schema input */
type SchemaFieldName<TSchema extends z.ZodObject> = Extract<
  keyof SchemaInput<TSchema>,
  string
>;

function pickSchema<
  TSchema extends z.ZodObject,
  TFieldName extends SchemaFieldName<TSchema>,
>(
  schema: TSchema,
  name: TFieldName
): z.ZodType<
  Record<TFieldName, SchemaOutput<TSchema>[TFieldName]>,
  Record<TFieldName, SchemaInput<TSchema>[TFieldName]>
> {
  const pickMask: Record<string, true> = {
    [name]: true,
  };
  const pickedSchema = schema.pick(pickMask);
  return pickedSchema as unknown as z.ZodType<
    Record<TFieldName, SchemaOutput<TSchema>[TFieldName]>,
    Record<TFieldName, SchemaInput<TSchema>[TFieldName]>
  >;
}

type AutoSaveFormData<TSchema extends z.ZodObject, TFieldName extends string> = Record<
  TFieldName,
  SchemaInput<TSchema>[TFieldName]
>;

type AutoSaveSubmitError<TFormData> = OnSubmitError<{
  fields: Partial<Record<DeepKeys<TFormData>, {message: string}>>;
}>;

type AutoSaveFieldChildren<
  TSchema extends z.ZodObject,
  TFieldName extends SchemaFieldName<TSchema>,
> = ReactFormFieldProps<
  AutoSaveFormData<TSchema, TFieldName>,
  TFieldName,
  DeepValue<AutoSaveFormData<TSchema, TFieldName>, TFieldName>,
  never,
  never,
  AutoSaveFormData<TSchema, TFieldName>,
  ToFormErrorTypes<
    Array<{
      run: z.ZodType<
        Record<TFieldName, SchemaOutput<TSchema>[TFieldName]>,
        AutoSaveFormData<TSchema, TFieldName>
      >;
      triggers: Array<'change'>;
    }>,
    Promise<AutoSaveSubmitError<AutoSaveFormData<TSchema, TFieldName>> | void>
  >,
  BoundFieldComponents
>['children'];

type AutoSaveFormProps<
  TData,
  TContext,
  TSchema extends z.ZodObject,
  TFieldName extends SchemaFieldName<TSchema>,
> = {
  /**
   * Render prop that receives field props and additional props.
   */
  children: AutoSaveFieldChildren<TSchema, TFieldName>;

  /**
   * Initial value - must match the schema's type for this field.
   */
  initialValue: SchemaInput<TSchema>[TFieldName];

  /**
   * TanStack Query mutation options - mutationFn receives single-field data.
   */
  mutationOptions: UseMutationOptions<
    TData,
    Error,
    NoInfer<Record<TFieldName, SchemaOutput<TSchema>[TFieldName]>>,
    TContext
  >;

  /** Field name - must be a valid string key in the schema. */
  name: TFieldName;

  /** Zod schema for validation. */
  schema: TSchema;

  /**
   * Optional confirmation dialog before saving.
   * Shows a modal and requires user confirmation before applying changes.
   */
  confirm?: ConfirmConfig<SchemaInput<TSchema>[TFieldName]>;
};

export function AutoSaveForm<
  TData,
  TContext,
  TSchema extends z.ZodObject<z.ZodRawShape>,
  TFieldName extends SchemaFieldName<TSchema>,
>(props: AutoSaveFormProps<TData, TContext, TSchema, TFieldName>) {
  const {name, schema, initialValue, mutationOptions, confirm, children} = props;
  const {t} = useTranslation();
  const id = useId();
  const mutation = useMutation(mutationOptions);
  // Track pending confirmation to prevent duplicate modals
  const pendingConfirmRef = useRef(false);
  const resetOnErrorRef = useRef(false);
  const fieldSchema = pickSchema(schema, name);

  const form = useScrapsForm({
    formId: `${name}-${id}-(auto-save)`,
    defaultValues: {[name]: initialValue} as Record<
      TFieldName,
      SchemaInput<TSchema>[TFieldName]
    >,
    validators: [
      {
        run: fieldSchema,
        triggers: ['change'],
      },
    ],
    listeners: [
      {
        run: ({formApi, triggerFieldApi}) => {
          if (!triggerFieldApi?.meta.isDefaultValue) {
            void formApi.handleSubmit();
          }
        },
        triggers: ['blur'],
      },
    ],
    errorVisibility: () => true,
    onSubmit: ({value, createValidationError}) => {
      if (mutation.status === 'pending' || pendingConfirmRef.current) {
        return Promise.resolve();
      }

      const parsedValue = fieldSchema.safeParse(value);

      if (!parsedValue.success) {
        return Promise.resolve();
      }

      const submittedValue = parsedValue.data;
      const fieldValue = value[name];

      const submit = () =>
        mutation
          .mutateAsync(submittedValue)
          .then(() => {
            form.reset();
          })
          .catch(error => {
            if (resetOnErrorRef.current) {
              // A full reset cancels the current v2 submission, including the
              // validation error returned below. Restore this field instead
              // so the error remains visible.
              form.setFieldValue(name, form.defaultValues[name] as never, {
                causeValidation: false,
                markAsDirty: false,
                markAsTouched: false,
              });
            }

            const isRequestError = error instanceof RequestError;
            const fieldErrors = isRequestError
              ? toFieldErrors({value, createValidationError}, error)
              : undefined;

            if (fieldErrors) {
              return fieldErrors;
            }

            const message = isRequestError
              ? getRequestErrorUserMessage(error, t('Failed to save'))
              : t('Failed to save');

            const fields = {[name]: {message}} as Partial<
              Record<DeepKeys<typeof value>, {message: string}>
            >;
            return createValidationError({fields});
          });

      // Determine confirmation message
      const confirmMessage =
        typeof confirm === 'function' ? confirm(fieldValue) : confirm;

      if (confirmMessage) {
        pendingConfirmRef.current = true;
        return new Promise<AutoSaveSubmitError<
          AutoSaveFormData<TSchema, TFieldName>
        > | void>(resolve => {
          openConfirmModal({
            message: confirmMessage,
            isDangerous: true,
            onConfirm: () => {
              pendingConfirmRef.current = false;
              void submit().then(resolve);
            },
            onClose: () => {
              // onClose is always called, even after confirming,
              // so we check pendingConfirmRef to avoid resetting the form
              // after a successful confirm
              if (pendingConfirmRef.current) {
                form.reset();
                resolve();
              }
              pendingConfirmRef.current = false;
            },
          });
        });
      }

      return submit();
    },
  });

  return (
    <form.AppForm>
      <AutoSaveContextProvider value={{status: mutation.status, resetOnErrorRef}}>
        <form.Field name={name}>{field => children(field)}</form.Field>
      </AutoSaveContextProvider>
    </form.AppForm>
  );
}
