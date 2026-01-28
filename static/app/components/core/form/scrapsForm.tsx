import {createFormHook, formOptions, revalidateLogic} from '@tanstack/react-form';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Meta} from '@sentry/scraps/form/field/meta';
import {Layout} from '@sentry/scraps/form/layout';
import {FieldGroup} from '@sentry/scraps/form/layout/fieldGroup';

import {InputField} from './field/inputField';
import {NumberField} from './field/numberField';
import {SelectField} from './field/selectField';
import {fieldContext, formContext, useFormContext} from './formContext';

export const defaultFormOptions = formOptions({
  onSubmitInvalid() {
    const InvalidInput = document.querySelector(
      '[aria-invalid="true"]'
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
  Meta,
  Layout,
} as const;

export type BoundFieldComponents = typeof fieldComponents;

const {useAppForm} = createFormHook({
  fieldComponents,
  formComponents: {
    FieldGroup,
    SubmitButton,
  },
  fieldContext,
  formContext,
});

function SubmitButton(props: ButtonProps) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={state => state.isSubmitting}>
      {isSubmitting => (
        <Button {...props} priority="primary" type="submit" disabled={isSubmitting} />
      )}
    </form.Subscribe>
  );
}

export const useScrapsForm = useAppForm;
