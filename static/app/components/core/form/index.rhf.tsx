import {createContext, useContext} from 'react';
import {
  useController,
  type Control,
  type FieldPath,
  type FieldPathValue,
  type FieldValues,
  type UseControllerReturn,
} from 'react-hook-form';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Input, type InputProps} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Select, type GeneralSelectValue} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import type {ReactSelect} from 'sentry/components/forms/controls/reactSelectWrapper';
import type {SelectValue} from 'sentry/types/core';

type FieldProps = {
  label: string;
  hintText?: string;
  required?: boolean;
};

// Context to hold the field controller state
const RHFFieldContext = createContext<UseControllerReturn<any, any> | null>(null);

function useRHFFieldContext() {
  const context = useContext(RHFFieldContext);
  if (!context) {
    throw new Error('RHF field components must be used within RHFField');
  }
  return context;
}

// Field wrapper that uses useController and provides context
export function RHFField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  name,
  control,
  children,
}: {
  children: (field: {
    onChange: (value: FieldPathValue<TFieldValues, TName>) => void;
    ref: React.Ref<any>;
    value: FieldPathValue<TFieldValues, TName>;
  }) => React.ReactNode;
  control: Control<TFieldValues>;
  name: TName;
}) {
  const controller = useController({name, control});

  return (
    <RHFFieldContext.Provider value={controller}>
      {children({
        value: controller.field.value,
        onChange: controller.field.onChange,
        ref: controller.field.ref,
      })}
    </RHFFieldContext.Provider>
  );
}

// Base Field component for layout
function Field({
  label,
  hintText,
  required,
  children,
}: FieldProps & {children: React.ReactNode}) {
  const {fieldState} = useRHFFieldContext();
  const hasError = !!fieldState.error;

  return (
    <Stack as="label" gap="sm">
      <Text>
        {label} {required ? <Text variant="danger">*</Text> : null}
      </Text>
      {children}
      {hintText ? (
        <Text size="sm" variant="muted">
          {hintText}
        </Text>
      ) : null}
      {hasError ? (
        <Text size="sm" variant="danger">
          {fieldState.error?.message}
        </Text>
      ) : null}
    </Stack>
  );
}

// Input field component
export function InputField({
  label,
  hintText,
  required,
  value,
  onChange,
  ref,
  ...props
}: FieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: string) => void;
    ref: React.Ref<HTMLInputElement>;
    value: string;
  }) {
  const {field, fieldState} = useRHFFieldContext();
  const hasError = !!fieldState.error;

  return (
    <Field label={label} hintText={hintText} required={required}>
      <Input
        {...props}
        ref={ref}
        value={value}
        aria-invalid={hasError}
        onBlur={field.onBlur}
        onChange={e => onChange(e.target.value)}
      />
    </Field>
  );
}

// Number field component
export function NumberField({
  label,
  hintText,
  required,
  value,
  onChange,
  ref,
  ...props
}: FieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: number) => void;
    ref: React.Ref<HTMLInputElement>;
    value: number;
  }) {
  const {field, fieldState} = useRHFFieldContext();
  const hasError = !!fieldState.error;

  return (
    <Field label={label} hintText={hintText} required={required}>
      <Input
        {...props}
        ref={ref}
        type="number"
        value={value}
        aria-invalid={hasError}
        onBlur={field.onBlur}
        onChange={e => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

// Select field component
export function SelectField({
  label,
  hintText,
  required,
  value,
  onChange,
  ref,
  ...props
}: FieldProps &
  Omit<React.ComponentProps<typeof Select>, 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: string) => void;
    ref: React.Ref<typeof ReactSelect<GeneralSelectValue>>;
    value: string;
  }) {
  const {field, fieldState} = useRHFFieldContext();
  const hasError = !!fieldState.error;

  return (
    <Field label={label} hintText={hintText} required={required}>
      <Select
        {...props}
        ref={ref}
        value={value}
        aria-invalid={hasError}
        onBlur={field.onBlur}
        onChange={(option: SelectValue<string>) => onChange(option?.value ?? '')}
      />
    </Field>
  );
}

// Submit button component
export function SubmitButton({
  isSubmitting,
  ...props
}: ButtonProps & {isSubmitting: boolean}) {
  return <Button {...props} type="submit" disabled={isSubmitting} />;
}
