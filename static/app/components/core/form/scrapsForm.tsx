import {createFormHook, formOptions, revalidateLogic} from '@tanstack/react-form';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import {InputField} from './fields/inputField';
import {NumberField} from './fields/numberField';
import {SelectField} from './fields/selectField';
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
} as const;

export type BoundFieldComponents = typeof fieldComponents;

const {useAppForm} = createFormHook({
  fieldComponents,
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
});

function SubmitButton(props: ButtonProps) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={state => state.isSubmitting}>
      {isSubmitting => <Button {...props} type="submit" disabled={isSubmitting} />}
    </form.Subscribe>
  );
}

export const useScrapsForm = useAppForm;
