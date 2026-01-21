import {
  useController,
  type Control,
  type FieldPath,
  type FieldPathValue,
  type FieldValues,
  type UseFormTrigger,
} from 'react-hook-form';
import {useMutation, type UseMutationOptions} from '@tanstack/react-query';

import {RHFField, SelectField} from './index.rhf';

/**
 * Option A: Render Prop Component (Recommended)
 *
 * A component that provides field props and mutation state via render prop.
 * Clean API similar to TanStack Form but leveraging RHF's architecture.
 *
 * @example
 * <RHFAutoSaveField
 *   name="lastName"
 *   control={form.control}
 *   trigger={form.trigger}
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
 *       ref={field.ref}
 *     />
 *   )}
 * </RHFAutoSaveField>
 */

interface RHFAutoSaveFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> {
  /**
   * Render prop that receives field props from RHF and additional props
   */
  children: (
    field: {
      onChange: (value: FieldPathValue<TFieldValues, TName>) => void;
      ref: React.Ref<any>;
      value: FieldPathValue<TFieldValues, TName>;
    },
    fieldProps: {
      disabled: boolean;
    }
  ) => React.ReactNode;

  /**
   * React Hook Form control from useForm
   */
  control: Control<TFieldValues>;

  /**
   * TanStack Query mutation options - mutationFn receives single-field data
   */
  mutationOptions: UseMutationOptions<
    any,
    Error,
    Record<TName, FieldPathValue<TFieldValues, TName>>
  >;

  /**
   * Field name - must be a valid path in the form values
   */
  name: TName;

  /**
   * React Hook Form trigger function from useForm for validation
   */
  trigger: UseFormTrigger<TFieldValues>;
}

export function RHFAutoSaveField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: RHFAutoSaveFieldProps<TFieldValues, TName>) {
  const {name, control, trigger, mutationOptions, children} = props;

  const controller = useController({name, control});
  const mutation = useMutation(mutationOptions);

  const handleBlur = async () => {
    // Only save if the field has been modified (is dirty)
    if (!controller.fieldState.isDirty) {
      return;
    }

    // Validate the field before saving
    const isValid = await trigger(name);

    if (isValid) {
      const fieldValue = controller.field.value;
      // Construct single-field object for mutation
      await mutation.mutateAsync({[name]: fieldValue});
    }
  };

  return (
    <div onBlur={handleBlur}>
      <RHFField name={name} control={control}>
        {field =>
          children(
            {
              value: field.value,
              onChange: field.onChange,
              ref: field.ref,
            },
            {
              disabled: mutation.isPending,
            }
          )
        }
      </RHFField>
    </div>
  );
}

interface RHFAutoSaveSelectProps<TFieldValues extends FieldValues> {
  /**
   * React Hook Form control from useForm
   */
  control: Control<TFieldValues>;

  /**
   * Field label
   */
  label: string;

  /**
   * TanStack Query mutation options - mutationFn receives single-field data
   */
  mutationOptions: UseMutationOptions<unknown, unknown, any>;

  /**
   * Field name - must be a valid path in the form values
   */
  name: FieldPath<TFieldValues>;

  /**
   * Select options
   */
  options: Array<{label: string; value: string}>;

  /**
   * React Hook Form trigger function from useForm for validation
   */
  trigger: UseFormTrigger<TFieldValues>;

  /**
   * Hint text displayed below the field
   */
  hintText?: string;

  /**
   * Whether the field is required
   */
  required?: boolean;
}

export function RHFAutoSaveSelect<TFieldValues extends FieldValues>(
  props: RHFAutoSaveSelectProps<TFieldValues>
) {
  const {
    name,
    control,
    trigger,
    mutationOptions,
    label,
    required,
    hintText,
    options,
    ...selectProps
  } = props;

  const mutation = useMutation(mutationOptions);

  const handleBlur = async () => {
    const fieldValue = control._getWatch(name);
    const isValid = await trigger(name);
    if (isValid) {
      await mutation.mutateAsync({[name]: fieldValue});
    }
  };

  return (
    <div onBlur={handleBlur}>
      <RHFField name={name} control={control}>
        {field => (
          <SelectField
            label={label}
            required={required}
            hintText={hintText}
            options={options}
            disabled={mutation.isPending}
            value={field.value as string}
            onChange={field.onChange as (value: string) => void}
            ref={field.ref}
            {...selectProps}
          />
        )}
      </RHFField>
    </div>
  );
}
