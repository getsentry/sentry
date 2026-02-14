import {useId} from 'react';
// eslint-disable-next-line no-restricted-imports
import type {DeepKeys, DeepValue, FieldApi} from '@tanstack/react-form';
import {useMutation, type UseMutationOptions} from '@tanstack/react-query';
import {type z} from 'zod';

import {AutoSaveContextProvider} from '@sentry/scraps/form/autoSaveContext';
import {useScrapsForm, type BoundFieldComponents} from '@sentry/scraps/form/scrapsForm';

/** Form data type coming from the schema */
type SchemaFieldName<TSchema extends z.ZodObject<z.ZodRawShape>> = Extract<
  DeepKeys<z.infer<TSchema>>,
  string
>;

/** FieldApi’s TData must be DeepValue<TParentData, TName> */
type SchemaFieldValue<
  TSchema extends z.ZodObject<z.ZodRawShape>,
  TFieldName extends SchemaFieldName<TSchema>,
> = DeepValue<z.infer<TSchema>, TFieldName>;

type AutoSaveFieldRenderArg<
  TSchema extends z.ZodObject<z.ZodRawShape>,
  TFieldName extends SchemaFieldName<TSchema>,
> = FieldApi<
  z.infer<TSchema>,
  TFieldName,
  SchemaFieldValue<TSchema, TFieldName>,
  // Field validators (all can be undefined to satisfy the constraints)
  undefined, // TOnMount
  undefined, // TOnChange
  undefined, // TOnChangeAsync
  undefined, // TOnBlur
  undefined, // TOnBlurAsync
  undefined, // TOnSubmit
  undefined, // TOnSubmitAsync
  undefined, // TOnDynamic
  undefined, // TOnDynamicAsync
  // Form validators (all can be undefined)
  undefined, // TFormOnMount
  undefined, // TFormOnChange
  undefined, // TFormOnChangeAsync
  undefined, // TFormOnBlur
  undefined, // TFormOnBlurAsync
  undefined, // TFormOnSubmit
  undefined, // TFormOnSubmitAsync
  undefined, // TFormOnDynamic
  undefined, // TFormOnDynamicAsync
  undefined, // TFormOnServer
  // Submit meta (use unknown unless you have a concrete type)
  unknown // TParentSubmitMeta
> & {
  // plus injected components like field.Input / field.Select
  [K in keyof BoundFieldComponents]: BoundFieldComponents[K];
};

/**
 * A component that provides field props and mutation state via render prop.
 *
 * @example
 * <AutoSaveField
 *   name="lastName"
 *   schema={baseUserSchema}
 *   initialValue={user.data?.lastName ?? ''}
 *   mutationOptions={{
 *     mutationFn: async (data) => api.patch('/user', data),
 *   }}
 * >
 *   {field => (
 *     <InputField
 *       label="Last Name:"
 *       required
 *       value={field.state.value}
 *       onChange={field.handleChange}
 *     />
 *   )}
 * </AutoSaveField>
 */

interface AutoSaveFieldProps<
  TSchema extends z.ZodObject<z.ZodRawShape>,
  TFieldName extends Extract<keyof z.infer<TSchema>, string>,
> {
  /**
   * Render prop that receives field props and additional props
   */
  children: (field: AutoSaveFieldRenderArg<TSchema, TFieldName>) => React.ReactNode;

  /**
   * Initial value - must match the schema's type for this field
   */
  initialValue: z.infer<TSchema>[TFieldName];

  /**
   * TanStack Query mutation options - mutationFn receives single-field data
   */
  mutationOptions: UseMutationOptions<
    z.infer<TSchema>,
    Error,
    Record<TFieldName, z.infer<TSchema>[TFieldName]>
  >;

  /**
   * Field name - must be a valid string key in the schema
   */
  name: TFieldName;

  /**
   * Zod schema for validation
   */
  schema: TSchema;
}

export function AutoSaveField<
  TSchema extends z.ZodObject<z.ZodRawShape>,
  TFieldName extends Extract<keyof z.infer<TSchema>, string>,
>(props: AutoSaveFieldProps<TSchema, TFieldName>) {
  const {name, schema, initialValue, mutationOptions, children} = props;

  const id = useId();
  const mutation = useMutation(mutationOptions);

  const form = useScrapsForm({
    formId: `${name}-${id}-(auto-save)`,
    defaultValues: {[name]: initialValue} as Record<
      TFieldName,
      z.infer<TSchema>[TFieldName]
    >,
    validators: {
      onChange: schema.pick({[name]: true}) as never,
    },
    listeners: {
      onBlur: ({formApi, fieldApi}) => {
        if (!fieldApi.state.meta.isDefaultValue) {
          void formApi.handleSubmit();
        }
      },
    },
    onSubmit: ({value}) => {
      if (mutation.status === 'pending') {
        return Promise.resolve();
      }
      return mutation.mutateAsync(value);
    },
  });

  return (
    <form.AppForm>
      <AutoSaveContextProvider value={{status: mutation.status}}>
        <form.FormWrapper>
          <form.AppField name={name}>{field => children(field as never)}</form.AppField>
        </form.FormWrapper>
      </AutoSaveContextProvider>
    </form.AppForm>
  );
}
