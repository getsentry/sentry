import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Input, type InputProps} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import type {SelectValue} from 'sentry/types/core';

type FieldProps = {
  label: string;
  'aria-invalid'?: boolean;
  error?: string;
  hintText?: string;
};

// Base Field component for layout
function Field({
  label,
  'aria-invalid': ariaInvalid,
  error,
  hintText,
  children,
}: FieldProps & {children: React.ReactNode}) {
  return (
    <Stack as="label" gap="sm">
      <Text>{label}</Text>
      {children}
      {hintText ? (
        <Text size="sm" variant="muted">
          {hintText}
        </Text>
      ) : null}
      {ariaInvalid && error ? (
        <Text size="sm" variant="danger">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}

// Input field component
export function InputField({
  label,
  'aria-invalid': ariaInvalid,
  error,
  hintText,
  value,
  onChange,
  onBlur,
  ...props
}: FieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur'> & {
    onBlur: () => void;
    onChange: (value: string) => void;
    value: string;
  }) {
  return (
    <Field label={label} aria-invalid={ariaInvalid} error={error} hintText={hintText}>
      <Input
        {...props}
        value={value}
        aria-invalid={ariaInvalid}
        onBlur={onBlur}
        onChange={e => onChange(e.target.value)}
      />
    </Field>
  );
}

// Number field component
export function NumberField({
  label,
  'aria-invalid': ariaInvalid,
  error,
  hintText,
  value,
  onChange,
  onBlur,
  ...props
}: FieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur'> & {
    onBlur: () => void;
    onChange: (value: number) => void;
    value: number;
  }) {
  return (
    <Field label={label} aria-invalid={ariaInvalid} error={error} hintText={hintText}>
      <Input
        {...props}
        type="number"
        value={value}
        aria-invalid={ariaInvalid}
        onBlur={onBlur}
        onChange={e => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

// Select field component
export function SelectField({
  label,
  'aria-invalid': ariaInvalid,
  error,
  hintText,
  value,
  onChange,
  onBlur,
  ...props
}: FieldProps &
  Omit<React.ComponentProps<typeof Select>, 'value' | 'onChange' | 'onBlur'> & {
    onBlur: () => void;
    onChange: (value: string) => void;
    value: string;
  }) {
  return (
    <Field label={label} aria-invalid={ariaInvalid} error={error} hintText={hintText}>
      <Select
        {...props}
        value={value}
        aria-invalid={ariaInvalid}
        onBlur={onBlur}
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
