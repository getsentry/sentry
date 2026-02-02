import {createFormHook, formOptions, revalidateLogic} from '@tanstack/react-form';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {FieldLayout} from '@sentry/scraps/form/layout';
import {FieldGroup} from '@sentry/scraps/form/layout/fieldGroup';

import {InputField} from './field/inputField';
import {NumberField} from './field/numberField';
import {SelectField} from './field/selectField';
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
  Select: SelectField,
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
