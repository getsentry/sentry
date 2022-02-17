import {createContext} from 'react';

import FormModel from 'sentry/components/forms/model';

/**
 * Context type used in 'settings' forms.
 *
 * These differ from the 'old' forms in that they use mobx observers
 * to update state and expose it via the `FormModel`
 */
export type FormContextData = {
  /**
   * The default value is undefined so that FormField components
   * not within a form context boundary create MockModels based
   * on their props.
   */
  form?: FormModel;
  /**
   * Should fields do save requests on blur?
   */
  saveOnBlur?: boolean;
};

const FormContext = createContext<FormContextData>({
  form: undefined,
  saveOnBlur: undefined,
});

export default FormContext;
