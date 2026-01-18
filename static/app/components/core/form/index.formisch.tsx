import {createContext, useContext} from 'react';
import {
  Field as FormischBaseField,
  setInput,
  type FormStore,
  type PathValue,
  type RequiredPath,
  type Schema,
  type ValidPath,
} from '@formisch/react';
import * as v from 'valibot';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Input, type InputProps} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import type {SelectValue} from 'sentry/types/core';

type FieldProps = {
  label: string;
  hintText?: string;
  required?: boolean;
};

// Context to hold the field state
const FormischFieldContext = createContext<{
  errors: [string, ...string[]] | null;
  fieldPath: any;
  fieldProps: {
    name: string;
    onBlur: (e: React.FocusEvent<any>) => void;
    onChange: (e: React.ChangeEvent<any>) => void;
    onFocus: (e: React.FocusEvent<any>) => void;
    ref: (element: any) => void;
  };
  formStore: FormStore<any>;
} | null>(null);

function useFormischFieldContext() {
  const context = useContext(FormischFieldContext);
  if (!context) {
    throw new Error('Formisch field components must be used within FormischField');
  }
  return context;
}

// Field wrapper that uses Formisch Field and provides context
export function FormischField<
  TSchema extends Schema,
  TFieldPath extends RequiredPath = RequiredPath,
>({
  of,
  path,
  children,
}: {
  children: (field: {
    onChange: (value: PathValue<v.InferInput<TSchema>, TFieldPath>) => void;
    value: PathValue<v.InferInput<TSchema>, TFieldPath>;
  }) => React.ReactNode;
  of: FormStore<TSchema>;
  path: ValidPath<v.InferInput<TSchema>, TFieldPath>;
}) {
  return (
    <FormischBaseField of={of} path={path}>
      {field => {
        return (
          <FormischFieldContext.Provider
            value={{
              errors: field.errors,
              fieldProps: field.props,
              formStore: of,
              fieldPath: path,
            }}
          >
            {children({
              // Cast away PartialValues since we always provide initial values
              value: field.input as PathValue<v.InferInput<TSchema>, TFieldPath>,
              // Don't use this onChange - it's just for API compatibility
              // The actual onChange is in context and used by field components
              onChange: () => {},
            })}
          </FormischFieldContext.Provider>
        );
      }}
    </FormischBaseField>
  );
}

// Base Field component for layout
function Field({
  label,
  hintText,
  required,
  children,
}: FieldProps & {children: React.ReactNode}) {
  const {errors} = useFormischFieldContext();
  const hasError = !!errors?.[0];
  const errorMessage = errors?.[0];

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
      {hasError && errorMessage ? (
        <Text size="sm" variant="danger">
          {errorMessage}
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
  ...props
}: FieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: string) => void;
    value: string;
  }) {
  const {errors, fieldProps} = useFormischFieldContext();
  const hasError = !!errors?.[0];

  return (
    <Field label={label} hintText={hintText} required={required}>
      <Input
        {...props}
        {...fieldProps}
        value={value}
        aria-invalid={hasError}
        onChange={e => {
          // Call Formisch's onChange with the real event
          fieldProps.onChange(e);
          // Also call the render prop's onChange for compatibility
          // (though it's a no-op in our implementation)
          onChange(e.target.value);
        }}
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
  ...props
}: FieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: number) => void;
    value: number;
  }) {
  const {errors, fieldProps} = useFormischFieldContext();
  const hasError = !!errors?.[0];

  return (
    <Field label={label} hintText={hintText} required={required}>
      <Input
        {...props}
        {...fieldProps}
        type="number"
        value={value}
        aria-invalid={hasError}
        onChange={e => {
          // Call Formisch's onChange with the real event
          fieldProps.onChange(e);
          // Also call the render prop's onChange for compatibility
          onChange(Number(e.target.value));
        }}
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
  ...props
}: FieldProps &
  Omit<React.ComponentProps<typeof Select>, 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: string) => void;
    value: string;
  }) {
  const {errors, fieldProps, formStore, fieldPath} = useFormischFieldContext();
  const hasError = !!errors?.[0];

  return (
    <Field label={label} hintText={hintText} required={required}>
      <Select
        {...props}
        name={fieldProps.name}
        onBlur={fieldProps.onBlur}
        value={value}
        aria-invalid={hasError}
        onChange={(option: SelectValue<string>) => {
          const newValue = option?.value ?? '';

          // Use Formisch's setInput API to update the field value
          setInput(formStore, {
            path: fieldPath,
            input: newValue,
          });

          // Call the render prop's onChange
          onChange(newValue);
        }}
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
