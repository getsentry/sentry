import {createContext, useContext} from 'react';
// eslint-disable-next-line no-restricted-imports
import {createFormHookContexts} from '@tanstack/react-form';

const {fieldContext, formContext, useFormContext, useFieldContext} =
  createFormHookContexts();

// Safari doesn't submit a form when the button has an explicit `form` attribute
// pointing at its own parent form. Only set the attribute when the button is
// rendered outside the <form> element.
const FormElementContext = createContext(false);
const useIsInsideFormElement = () => useContext(FormElementContext);

export {
  fieldContext,
  formContext,
  useFormContext,
  useFieldContext,
  FormElementContext,
  useIsInsideFormElement,
};
