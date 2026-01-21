import {formOptions} from '@tanstack/react-form';
import {useMutation, type UseMutationOptions} from '@tanstack/react-query';
import type {z} from 'zod';

import {useScrapsForm} from './index.tanstack';

export const autoSaveOptions = <
  TSchema extends z.ZodObject<z.ZodRawShape>,
  TFieldName extends Extract<keyof z.infer<TSchema>, string>,
>({
  initialValue,
  name,
  schema,
}: {
  initialValue: z.infer<TSchema>[TFieldName];
  name: TFieldName;
  schema: TSchema;
}) =>
  formOptions({
    formId: `auto-save-${name}`,
    defaultValues: {[name]: initialValue},
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
  });

/**
 * AutoSaveField Component
 *
 * A component that provides field props and mutation state via render prop.
 * Clean API matching RHF's pattern but for TanStack Form.
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
 *   {(field, fieldProps) => (
 *     <InputField
 *       label="Last Name:"
 *       required
 *       {...fieldProps}
 *       value={field.value}
 *       onChange={field.onChange}
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
  children: (
    field: {
      handleChange: (value: z.infer<TSchema>[TFieldName]) => void;
      state: {
        value: z.infer<TSchema>[TFieldName];
      };
    },
    fieldProps: {
      disabled: boolean;
    }
  ) => React.ReactNode;

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

  const mutation = useMutation(mutationOptions);

  const form = useScrapsForm({
    ...autoSaveOptions({schema, name, initialValue}),
    onSubmit: ({value}) => {
      return mutation.mutateAsync(
        value as Record<TFieldName, z.infer<TSchema>[TFieldName]>
      );
    },
  });

  return (
    <form.AppField name={name}>
      {field => {
        // type X = typeof field;
        return children(
          {
            handleChange: field.handleChange,
            state: {
              value: field.state.value,
            },
          },
          {
            disabled: mutation.isPending,
          }
        );
      }}
    </form.AppField>
  );
}
