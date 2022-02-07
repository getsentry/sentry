import {createContext} from 'react';

/**
 * Context type used on 'classic' or 'old' forms.
 *
 * This is a very different type than what is used on the 'settings'
 * forms which have MobX under the hood.
 */
export type FormContextData = {
  form?: {
    data: object;
    errors: object;
    onFieldChange: (name: string, value: string | number) => void;
  };
};

/**
 * Default to undefined to preserve backwards compatibility.
 * The FormField component uses a truthy test to see if it is connected
 * to context or if the control is 'uncontrolled'.
 */
const FormContext = createContext<FormContextData>({});

export default FormContext;
