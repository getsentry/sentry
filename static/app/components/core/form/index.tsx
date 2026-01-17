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

type FieldChildrenProps<T = never> = {
  'aria-invalid': boolean;
  name: string;
  onBlur: (e: React.FocusEvent) => void;
  onChange: (value: T) => void;
  value: T;
};

export function Field<T = never>(
  props: FieldProps & {children: (props: FieldChildrenProps<T>) => React.ReactNode}
) {
  const field = useFieldContext<T>();
  const hasError = field.state.meta.isTouched && !field.state.meta.isValid;
  return (
    <Stack as="label" gap="sm">
      <Text> {props.label} </Text>
      {props.children({
        value: field.state.value,
        'aria-invalid': hasError,
        onChange: field.handleChange,
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

function InputField(props: FieldProps & Omit<InputProps, 'type'>) {
  return (
    <Field<string> label={props.label} hintText={props.hintText}>
      {fieldProps => (
        <Input
          {...props}
          {...fieldProps}
          onChange={e => fieldProps.onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

function NumberField(props: FieldProps & Omit<InputProps, 'type'>) {
  return (
    <Field<number> label={props.label} hintText={props.hintText}>
      {fieldProps => (
        <Input
          type="number"
          {...props}
          {...fieldProps}
          onChange={e => fieldProps.onChange(Number(e.target.value))}
        />
      )}
    </Field>
  );
}

function SelectField(props: FieldProps & React.ComponentProps<typeof Select>) {
  return (
    <Field<string> label={props.label} hintText={props.hintText}>
      {fieldProps => (
        <Select
          {...props}
          {...fieldProps}
          onChange={(option: SelectValue<string>) =>
            fieldProps.onChange(option?.value ?? '')
          }
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
