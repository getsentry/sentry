import {createContext, useContext} from 'react';

import type {FieldErrors} from './scrapsForm';

export type MappedFormError<TFormData> =
  | {fieldErrors: FieldErrors<TFormData>}
  | {message: string};

export type FormErrorMapper = <TFormData>(
  error: Error,
  formValues: TFormData,
  fallbackMessage: string
) => MappedFormError<TFormData> | undefined;

const FormErrorContext = createContext<FormErrorMapper>(() => {
  return;
});

export const FormErrorContextProvider = FormErrorContext.Provider;

export function useFormErrorMapper(): FormErrorMapper {
  return useContext(FormErrorContext);
}
