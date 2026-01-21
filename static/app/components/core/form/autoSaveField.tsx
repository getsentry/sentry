import {formOptions} from '@tanstack/react-form';
import type {z} from 'zod';

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
