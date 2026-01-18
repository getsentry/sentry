import {createFormHook, createFormHookContexts, formOptions} from '@tanstack/react-form';

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

export const defaultFormOptions = formOptions({
  onSubmitInvalid() {
    const InvalidInput = document.querySelector(
      '[aria-invalid="true"]'
    ) as HTMLInputElement;

    InvalidInput?.focus();
  },
});

const {fieldContext, formContext, useFormContext, useFieldContext} =
  createFormHookContexts();

const {useAppForm} = createFormHook({
  fieldComponents: {
    Input: InputField,
    Number: NumberField,
    Select: SelectField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
});

export const useScrapsForm = useAppForm;

type FieldChildrenProps = {
  'aria-invalid': boolean;
  name: string;
  onBlur: () => void;
};

export function Field(
  props: FieldProps & {children: (props: FieldChildrenProps) => React.ReactNode}
) {
  const field = useFieldContext();
  const hasError = field.state.meta.isTouched && !field.state.meta.isValid;
  return (
    <Stack as="label" gap="sm">
      <Text>
        {props.label} {props.required ? <Text variant="danger">*</Text> : null}
      </Text>
      {props.children({
        'aria-invalid': hasError,
        onBlur: field.handleBlur,
        name: field.name,
      })}
      {props.hintText ? (
        <Text size="sm" variant="muted">
          {props.hintText}
        </Text>
      ) : null}
      {hasError ? (
        <Text size="sm" variant="danger">
          {field.state.meta.errors.map(e => e?.message).join(',')}
        </Text>
      ) : null}
    </Stack>
  );
}

function InputField({
  label,
  hintText,
  onChange,
  required,
  ...props
}: FieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: string) => void;
    value: string;
  }) {
  return (
    <Field label={label} hintText={hintText} required={required}>
      {fieldProps => (
        <Input {...fieldProps} {...props} onChange={e => onChange(e.target.value)} />
      )}
    </Field>
  );
}

function NumberField({
  label,
  hintText,
  onChange,
  required,
  ...props
}: FieldProps &
  Omit<InputProps, 'type' | 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: number) => void;
    value: number;
  }) {
  return (
    <Field label={label} hintText={hintText} required={required}>
      {fieldProps => (
        <Input
          {...fieldProps}
          {...props}
          type="number"
          onChange={e => onChange(Number(e.target.value))}
        />
      )}
    </Field>
  );
}

function SelectField({
  label,
  hintText,
  onChange,
  required,
  ...props
}: FieldProps &
  Omit<React.ComponentProps<typeof Select>, 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: string) => void;
    value: string;
  }) {
  return (
    <Field label={label} hintText={hintText} required={required}>
      {fieldProps => (
        <Select
          {...fieldProps}
          {...props}
          onChange={(option: SelectValue<string>) => onChange(option?.value ?? '')}
        />
      )}
    </Field>
  );
}

function SubmitButton(props: ButtonProps) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={state => state.isSubmitting}>
      {isSubmitting => <Button {...props} type="submit" disabled={isSubmitting} />}
    </form.Subscribe>
  );
}
