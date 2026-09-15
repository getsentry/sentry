// eslint-disable-next-line no-restricted-imports
import {
  createFormHook,
  formOptions,
  revalidateLogic,
  type AnyFormApi,
  type DeepKeys,
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
import {SelectAsyncField} from './field/selectAsyncField';
import {SelectField} from './field/selectField';
import {SwitchField} from './field/switchField';
import {TextAreaField} from './field/textAreaField';
import {
  FormElementContext,
  fieldContext,
  formContext,
  useFormContext,
  useIsInsideFormElement,
} from './formContext';

export const defaultFormOptions = formOptions({
  onSubmitInvalid({
    formApi,
  }: {
    formApi: {formId: string; validateSync: (cause: 'submit') => unknown};
  }) {
    // TanStack bails out of submission as soon as a field-level validator fails,
    // before it ever runs the form-level (schema) validators. Fields validated
    // only by the schema would then show no error at all, so run them here.
    formApi.validateSync('submit');

    // https://github.com/typescript-eslint/typescript-eslint/issues/10722
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    const InvalidInput = document.querySelector(
      `#${CSS.escape(formApi.formId)} [aria-invalid="true"]`
    ) as HTMLInputElement;

    InvalidInput?.focus();
  },
  validationLogic: revalidateLogic({
    mode: 'submit',
    modeAfterSubmission: 'change',
  }),
});

const fieldComponents = {
  Base: BaseField,
  Input: InputField,
  Number: NumberField,
  Password: PasswordField,
  Radio: RadioField,
  Range: RangeField,
  Select: SelectField,
  SelectAsync: SelectAsyncField,
  Switch: SwitchField,
  TextArea: TextAreaField,
  Meta: FieldMeta,
  Layout: FieldLayout,
} as const;

export type BoundFieldComponents = typeof fieldComponents;

const {useAppForm, withFieldGroup, withForm} = createFormHook({
  fieldComponents,
  formComponents: {
    FieldGroup,
    SubmitButton,
    ResetButton,
    AppForm,
  },
  fieldContext,
  formContext,
});

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

function AppForm({children, form}: {children: React.ReactNode; form: AnyFormApi}) {
  return (
    <formContext.Provider value={form}>
      <FormWrapper>{children}</FormWrapper>
    </formContext.Provider>
  );
}

function FormWrapper({children}: {children: React.ReactNode}) {
  const form = useFormContext();

  return (
    <form
      noValidate
      data-test-id={form.formId}
      id={form.formId}
      style={{width: '100%'}}
      onSubmit={e => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FormElementContext.Provider value>{children}</FormElementContext.Provider>
    </form>
  );
}

export const useScrapsForm = useAppForm;
/** @public */
export {formOptions, withFieldGroup, withForm};

/**
 * Type for field errors that can be set after form submission (e.g., from backend validation).
 * Keys are constrained to valid field paths (including nested paths like 'address.city').
 */
export type FieldErrors<TFormData> = Partial<
  Record<DeepKeys<TFormData>, {message: string}>
>;

/**
 * Infers the form data type from a form API instance.
 */
type InferFormData<T> = T extends {state: {values: infer D}} ? D : never;

/**
 * Sets field errors on a form after submission (e.g., from backend validation).
 * This provides a type-safe way to set errors on specific fields.
 *
 * @returns `true` if field errors were set, or `false` if the object was empty.
 *
 * @example
 * ```tsx
 * setFieldErrors(formApi, {
 *   firstName: { message: 'This name is already taken' },
 *   'address.city': { message: 'City not found' },
 * });
 * ```
 */
export function setFieldErrors<
  TForm extends {setErrorMap: (...args: any[]) => unknown; state: {values: unknown}},
>(formApi: TForm, errors: FieldErrors<InferFormData<TForm>>): boolean {
  if (Object.keys(errors).length === 0) {
    return false;
  }

  formApi.setErrorMap({
    onSubmit: {
      fields: errors,
    },
  });
  return true;
}
