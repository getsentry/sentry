import {useMutation, type UseMutationOptions} from '@tanstack/react-query';
import type {z} from 'zod';

import {useScrapsForm} from './index.tanstack';

interface AutoSaveFieldProps<
  TSchema extends z.ZodObject<z.ZodRawShape>,
  TFieldName extends Extract<keyof z.infer<TSchema>, string>,
> {
  /**
   * Render prop - receives TanStack Form's field API and mutation state
   *
   * The field parameter is fully typed by TanStack Form and includes:
   * - field.Input, field.Number, field.Select components
   * - field.state.value, field.handleChange
   *
   * TypeScript will provide full autocomplete for the field parameter.
   */
  children: (
    field: {
      Input: React.ComponentType<Record<string, unknown>>;
      Number: React.ComponentType<Record<string, unknown>>;
      Select: React.ComponentType<Record<string, unknown>>;
      handleChange: (value: z.infer<TSchema>[TFieldName]) => void;
      state: {
        meta: {
          errors: string[];
          isTouched: boolean;
          isValid: boolean;
        };
        value: z.infer<TSchema>[TFieldName];
      };
    },
    props: {disabled: boolean}
  ) => React.ReactNode;

  /**
   * Initial value - must match the schema's type for this field
   */
  initialValue: z.infer<TSchema>[TFieldName];

  /**
   * TanStack Query mutation options - mutationFn receives single-field data
   */
  mutationOptions: UseMutationOptions<z.infer<TSchema>, Error, Partial<z.infer<TSchema>>>;

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
    formId: `auto-save-${name}`,
    defaultValues: {[name]: initialValue},
    validators: {
      onChange: schema.pick({[name]: true}) as never,
    },
    onSubmit: ({value}) => {
      return mutation.mutateAsync({[name]: value[name]} as Partial<z.infer<TSchema>>);
    },
    listeners: {
      onBlur: ({fieldApi}) => {
        if (!fieldApi.state.value.isDefaultValue) {
          void form.handleSubmit();
        }
      },
    },
  });

  return (
    <form.AppField name={name}>
      {field =>
        // Internal type assertion: TanStack Form's FieldApi has 23 type parameters
        // which we cannot fully express. The actual field object matches our interface.
        children(field as unknown as Parameters<typeof children>[0], {
          disabled: mutation.isPending,
        })
      }
    </form.AppField>
  );
}
