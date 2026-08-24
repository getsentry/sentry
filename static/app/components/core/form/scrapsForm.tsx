// eslint-disable-next-line no-restricted-imports
import {
  createFormHook,
  createValidator,
  type CreateValidationErrorFn,
  type DeepKeys,
  type OnSubmitError,
  type ReactAppFormApi,
} from '@tanstack/react-form';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {BaseField} from '@sentry/scraps/form/field/baseField';
import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {FieldLayout} from '@sentry/scraps/form/layout';
import {FieldGroup} from '@sentry/scraps/form/layout/fieldGroup';

import {RequestError} from 'sentry/utils/requestError/requestError';

import {InputField} from './field/inputField';
import {NumberField} from './field/numberField';
import {PasswordField} from './field/passwordField';
import {RadioField} from './field/radioField';
import {RangeField} from './field/rangeField';
import {SelectAsyncFieldWithField} from './field/selectAsyncField';
import {SelectFieldWithField} from './field/selectField';
import {SwitchField} from './field/switchField';
import {TextAreaField} from './field/textAreaField';
import {FormElementContext, useIsInsideFormElement} from './formContext';
import {fieldComponent} from './formHelpers';

function SubmitButton(props: ButtonProps) {
  const form = useFormContext();
  const isInsideForm = useIsInsideFormElement();

  return (
    <form.Subscribe selector={state => state.isSubmitting}>
      {isSubmitting => (
        <Button
          variant="primary"
          {...props}
          type="submit"
          form={isInsideForm ? undefined : form.formId}
          busy={isSubmitting || props.busy}
          disabled={isSubmitting || props.disabled}
        />
      )}
    </form.Subscribe>
  );
}

function ResetButton(props: ButtonProps) {
  const form = useFormContext();

  return (
    <form.Subscribe selector={state => state.isPristine}>
      {isPristine => (
        <Button
          {...props}
          disabled={props.disabled || isPristine}
          onClick={e => {
            form.reset();
            props.onClick?.(e);
          }}
        />
      )}
    </form.Subscribe>
  );
}

function Form({children}: {children: React.ReactNode}) {
  const form = useFormContext();

  return (
    <form
      noValidate
      data-test-id={form.formId}
      id={form.formId}
      style={{width: '100%'}}
      onSubmit={e => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FormElementContext.Provider value>{children}</FormElementContext.Provider>
    </form>
  );
}

const fieldComponents = {
  Base: BaseField,
  Input: fieldComponent.loose(InputField, 'field'),
  Number: fieldComponent.loose(NumberField, 'field'),
  Password: fieldComponent.loose(PasswordField, 'field'),
  Radio: RadioField,
  Range: fieldComponent.loose(RangeField, 'field'),
  Select: SelectFieldWithField,
  SelectAsync: SelectAsyncFieldWithField,
  Switch: fieldComponent.loose(SwitchField, 'field'),
  TextArea: fieldComponent.loose(TextAreaField, 'field'),
  Meta: FieldMeta,
  Layout: FieldLayout,
} as const;

export type BoundFieldComponents = typeof fieldComponents;

const formComponents = {
  FieldGroup,
  SubmitButton,
  ResetButton,
  Form,
} as const;

export type BoundFormComponents = typeof formComponents;

const {useAppForm, useFormContext, appFormOptions, defineAppFieldGroup} = createFormHook({
  fieldComponents,
  formComponents,
  defaultFormOptions: {
    errorVisibility: ({state}) => state.submissionAttempts > 0,
    onSubmitInvalid({formApi}) {
      const invalidInput = document.querySelector<HTMLElement>(
        `#${CSS.escape(formApi.formId)} [aria-invalid="true"]`
      );

      invalidInput?.focus();
    },
  },
});

export const useScrapsForm = useAppForm;

/** @public */
export {appFormOptions as formOptions, defineAppFieldGroup};

export function ScrapsForm({
  form,
  children,
}: {
  children: React.ReactNode;
  form: ReactAppFormApi<
    any,
    any,
    {fieldComponents: BoundFieldComponents; formComponents: BoundFormComponents}
  >;
}) {
  return (
    <form.AppForm>
      <form.Form>{children}</form.Form>
    </form.AppForm>
  );
}

export const validateOnSubmitThenChange = createValidator({
  triggers: [
    {
      trigger: 'change',
      when: ({formApi}) => formApi.state.submissionAttempts > 0,
    },
  ],
});

/**
 * Type for field errors that can be returned after form submission (e.g., from
 * backend validation). Keys are constrained to valid field paths.
 */
type FieldErrors<TFormData> = Partial<Record<DeepKeys<TFormData>, {message: string}>>;

type FieldValidationError<TValue> = {fields: FieldErrors<TValue>};

/**
 * Converts field errors from a form submission into a validation error.
 *
 * Accepts either a `FieldErrors` object for manually constructed errors, or a
 * `RequestError` to automatically extract field errors from `responseJSON`.
 * When given a `RequestError`, only keys matching existing form fields are used.
 * String values are used directly; array values use the first element.
 *
 * @returns A validation error when field errors were found, otherwise undefined.
 */
export function toFieldErrors<TValue>(
  context: {
    createValidationError: CreateValidationErrorFn<TValue>;
    value: TValue;
  },
  errors: FieldErrors<TValue> | RequestError
): OnSubmitError<FieldValidationError<TValue>> | undefined {
  if (errors instanceof RequestError) {
    const responseJSON = errors.responseJSON;
    if (!responseJSON) {
      return undefined;
    }

    const formValues = context.value;
    const fieldErrors: FieldErrors<TValue> = {};

    for (const key of Object.keys(responseJSON)) {
      if (typeof formValues === 'object' && formValues !== null && key in formValues) {
        const value = responseJSON[key];
        if (typeof value === 'string') {
          fieldErrors[key as DeepKeys<TValue>] = {message: value};
        } else if (Array.isArray(value) && value.length > 0) {
          fieldErrors[key as DeepKeys<TValue>] = {
            message: typeof value[0] === 'string' ? value[0] : String(value[0]),
          };
        }
      }
    }

    return Object.keys(fieldErrors).length > 0
      ? context.createValidationError({fields: fieldErrors})
      : undefined;
  }

  return Object.keys(errors).length > 0
    ? context.createValidationError({fields: errors})
    : undefined;
}
