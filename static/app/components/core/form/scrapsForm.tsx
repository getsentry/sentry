// eslint-disable-next-line no-restricted-imports
import {
  createFormHook,
  createValidators,
  type CreateValidationErrorFn,
  type DeepKeys,
  type FormErrorTypes,
  type OnSubmitError,
  type ReactAppFormApi,
} from '@tanstack/react-form';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {BaseField} from '@sentry/scraps/form/field/baseField';
import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {FieldLayout} from '@sentry/scraps/form/layout';
import {FieldGroup} from '@sentry/scraps/form/layout/fieldGroup';

import {InputField} from './field/inputField';
import {NumberField} from './field/numberField';
import {PasswordField} from './field/passwordField';
import {RadioField} from './field/radioField';
import {RangeField} from './field/rangeField';
import {SelectAsyncLooseField} from './field/selectAsyncField';
import {SelectLooseField} from './field/selectField';
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
  Select: SelectLooseField,
  SelectAsync: SelectAsyncLooseField,
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

const {useAppForm, useFormContext, defineAppFieldGroup} = createFormHook({
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
export {defineAppFieldGroup};
export type {CreateValidationErrorFn};

export function ScrapsForm<TFormData, TFormErrorTypes extends FormErrorTypes>({
  form,
  children,
}: {
  children: React.ReactNode;
  form: ReactAppFormApi<
    TFormData,
    TFormErrorTypes,
    {fieldComponents: BoundFieldComponents; formComponents: BoundFormComponents}
  >;
}) {
  return (
    <form.AppForm>
      <form.Form>{children}</form.Form>
    </form.AppForm>
  );
}

export const defaultFormValidators = createValidators([
  {
    triggers: [
      {
        trigger: 'change',
        when: ({formApi}) => formApi.state.submissionAttempts > 0,
      },
      {
        trigger: 'blur',
        when: ({formApi}) => formApi.state.submissionAttempts > 0,
      },
    ],
  },
]);

/**
 * Type for field errors that can be returned after form submission (e.g., from
 * backend validation). Keys are constrained to valid field paths.
 */
export type FieldErrors<TFormData> = Partial<
  Record<DeepKeys<TFormData>, {message: string}>
>;

type FieldValidationError<TValue> = {fields: FieldErrors<TValue>};

/**
 * Converts field errors from a form submission into a validation error.
 *
 * Return the result from `onSubmit` to attach the errors to the form. Sentry
 * API errors are mapped to the `FieldErrors` contract first — see
 * `requestErrorToFieldErrors`.
 *
 * @returns A validation error when field errors were found, otherwise undefined.
 *
 * @example
 * ```tsx
 * onSubmit: ({value, createValidationError}) =>
 *   mutation.mutateAsync(value).catch(error => {
 *     if (error instanceof RequestError) {
 *       return toFieldErrors(
 *         {value, createValidationError},
 *         requestErrorToFieldErrors(error, value)
 *       );
 *     }
 *     throw error;
 *   }),
 * ```
 */
export function toFieldErrors<TValue>(
  context: {
    createValidationError: CreateValidationErrorFn<TValue>;
    value: TValue;
  },
  errors: FieldErrors<TValue>
): OnSubmitError<FieldValidationError<TValue>> | undefined {
  if (Object.keys(errors).length === 0) {
    return undefined;
  }

  return context.createValidationError({fields: errors});
}
