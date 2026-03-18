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

import RequestError from 'sentry/utils/requestError/requestError';

import {InputField} from './field/inputField';
import {NumberField} from './field/numberField';
import {PasswordField} from './field/passwordField';
import {RadioField} from './field/radioField';
import {RangeField} from './field/rangeField';
import {SelectAsyncField} from './field/selectAsyncField';
import {SelectField} from './field/selectField';
import {SwitchField} from './field/switchField';
import {TextAreaField} from './field/textAreaField';
import {fieldContext, formContext, useFormContext} from './formContext';

export const defaultFormOptions = formOptions({
  onSubmitInvalid({formApi}: {formApi: {formId: string}}) {
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

const {useAppForm} = createFormHook({
  fieldComponents,
  formComponents: {
    FieldGroup,
    SubmitButton,
    AppForm,
  },
  fieldContext,
  formContext,
});

function SubmitButton(props: ButtonProps) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={state => state.isSubmitting}>
      {isSubmitting => (
        <Button
          {...props}
          priority="primary"
          type="submit"
          form={form.formId}
          busy={isSubmitting}
          disabled={isSubmitting || props.disabled}
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
      data-test-id={form.formId}
      id={form.formId}
      style={{width: '100%', flexGrow: 1}}
      onSubmit={e => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      {children}
    </form>
  );
}

export const useScrapsForm = useAppForm;

/**
 * Type for field errors that can be set after form submission (e.g., from backend validation).
 * Keys are constrained to valid field paths (including nested paths like 'address.city').
 */
type FieldErrors<TFormData> = Partial<Record<DeepKeys<TFormData>, {message: string}>>;

/**
 * Infers the form data type from a form API instance.
 */
type InferFormData<T> = T extends {state: {values: infer D}} ? D : never;

/**
 * Sets field errors on a form after submission (e.g., from backend validation).
 * This provides a type-safe way to set errors on specific fields.
 *
 * Accepts either a `FieldErrors` object for manually constructed errors, or a
 * `RequestError` to automatically extract field errors from `responseJSON`.
 * When given a `RequestError`, only keys matching existing form fields are used.
 * String values are used directly; array values use the first element.
 *
 * @example
 * ```tsx
 * // With manual field errors:
 * setFieldErrors(formApi, {
 *   firstName: { message: 'This name is already taken' },
 *   'address.city': { message: 'City not found' },
 * });
 *
 * // With a RequestError (e.g., in an onSubmit handler):
 * onSubmit: ({value, formApi}) => {
 *   return mutation.mutateAsync(value).catch((error: RequestError) => {
 *     setFieldErrors(formApi, error);
 *   });
 * },
 * ```
 */
export function setFieldErrors<
  TForm extends {setErrorMap: (...args: any[]) => unknown; state: {values: unknown}},
>(formApi: TForm, errors: FieldErrors<InferFormData<TForm>> | RequestError): void {
  if (errors instanceof RequestError) {
    const responseJSON = errors.responseJSON;
    if (!responseJSON) {
      return;
    }
    const formValues = formApi.state.values;
    const fieldErrors: Record<string, {message: string}> = {};

    for (const key of Object.keys(responseJSON)) {
      if (typeof formValues === 'object' && formValues !== null && key in formValues) {
        const value = responseJSON[key];
        if (typeof value === 'string') {
          fieldErrors[key] = {message: value};
        } else if (Array.isArray(value) && value.length > 0) {
          fieldErrors[key] = {
            message: typeof value[0] === 'string' ? value[0] : String(value[0]),
          };
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      formApi.setErrorMap({
        onSubmit: {fields: fieldErrors},
      });
    }
    return;
  }
  formApi.setErrorMap({
    onSubmit: {
      fields: errors,
    },
  });
}
