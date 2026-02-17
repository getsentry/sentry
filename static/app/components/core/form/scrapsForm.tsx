// eslint-disable-next-line no-restricted-imports
import {
  createFormHook,
  formOptions,
  revalidateLogic,
  type DeepKeys,
} from '@tanstack/react-form';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {FieldLayout} from '@sentry/scraps/form/layout';
import {FieldGroup} from '@sentry/scraps/form/layout/fieldGroup';

import {InputField} from './field/inputField';
import {NumberField} from './field/numberField';
import {RangeField} from './field/rangeField';
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
  Input: InputField,
  Number: NumberField,
  Range: RangeField,
  Select: SelectField,
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
    FormWrapper,
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
          disabled={isSubmitting || props.disabled}
        />
      )}
    </form.Subscribe>
  );
}

function FormWrapper({children}: {children: React.ReactNode}) {
  const form = useFormContext();

  return (
    <form
      id={form.formId}
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
 * @example
 * ```tsx
 * const form = useScrapsForm({
 *   defaultValues: { firstName: '', lastName: '', address: { city: '' } },
 * });
 *
 * // In onSubmit handler or after receiving backend errors:
 * setFieldErrors(form, {
 *   firstName: { message: 'This name is already taken' },
 *   'address.city': { message: 'City not found' },
 * });
 * ```
 */
export function setFieldErrors<
  TForm extends {setErrorMap: (...args: any[]) => unknown; state: {values: unknown}},
>(formApi: TForm, errors: FieldErrors<InferFormData<TForm>>): void {
  formApi.setErrorMap({
    onSubmit: {
      fields: errors,
    },
  });
}
