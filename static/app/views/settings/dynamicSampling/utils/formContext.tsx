import {createContext, useCallback, useContext, useState} from 'react';

interface FormState<FormFields extends Record<string, any>> {
  /**
   * State for each field in the form.
   */
  fields: {
    [K in keyof FormFields]: {
      hasChanged: boolean;
      initialValue: FormFields[K];
      onChange: (value: FormFields[K]) => void;
      value: FormFields[K];
      error?: string;
    };
  };
  /**
   * Whether the form has changed from the initial values.
   */
  hasChanged: boolean;
  /**
   * Whether the form is valid.
   * A form is valid if all fields pass validation.
   */
  isValid: boolean;
  /**
   * Resets the form state to the initial values.
   */
  reset: () => void;
  /**
   * Saves the form state by setting the initial values to the current values.
   */
  save: () => void;
}

export type FormValidators<FormFields extends Record<string, any>> = {
  [K in keyof FormFields]?: (value: FormFields[K]) => string | undefined;
};

type InitialValues<FormFields extends Record<string, any>> = {
  [K in keyof FormFields]: FormFields[K];
};

/**
 * Creates a form state object with fields and validation for a given set of form fields.
 */
export const useFormState = <FormFields extends Record<string, any>>(config: {
  initialValues: InitialValues<FormFields>;
  validators?: FormValidators<FormFields>;
}): FormState<FormFields> => {
  const [initialValues, setInitialValues] = useState(config.initialValues);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<{[K in keyof FormFields]?: string}>({});

  const setValue = useCallback(
    <K extends keyof FormFields>(name: K, value: FormFields[K]) => {
      setValues(old => ({...old, [name]: value}));
    },
    []
  );

  const setError = useCallback(
    <K extends keyof FormFields>(name: K, error: string | undefined) => {
      setErrors(old => ({...old, [name]: error}));
    },
    []
  );

  /**
   * Validates a field by running the field's validator function.
   */
  const validateField = useCallback(
    <K extends keyof FormFields>(name: K, value: FormFields[K]) => {
      const validator = config.validators?.[name];
      return validator?.(value);
    },
    [config.validators]
  );

  const handleFieldChange = <K extends keyof FormFields>(
    name: K,
    value: FormFields[K]
  ) => {
    setValue(name, value);
    setError(name, validateField(name, value));
  };

  return {
    fields: Object.entries(values).reduce((acc, [name, value]) => {
      acc[name as keyof FormFields] = {
        value,
        onChange: inputValue => handleFieldChange(name as keyof FormFields, inputValue),
        error: errors[name as keyof FormFields],
        hasChanged: value !== initialValues[name],
        initialValue: initialValues[name],
      };
      return acc;
    }, {} as any),
    isValid: Object.values(errors).every(error => !error),
    hasChanged: Object.entries(values).some(
      ([name, value]) => value !== initialValues[name]
    ),
    save: () => {
      setInitialValues(values);
    },
    reset: () => {
      setValues(initialValues);
      setErrors({});
    },
  };
};

/**
 * Creates a form context and hooks for a form with a given set of fields to enable type-safe form handling.
 */
export const createForm = <FormFields extends Record<string, any>>({
  validators,
}: {
  validators?: FormValidators<FormFields>;
}) => {
  const FormContext = createContext<FormState<FormFields> | undefined>(undefined);

  function FormProvider({
    children,
    formState,
  }: {
    children: React.ReactNode;
    formState: FormState<FormFields>;
  }) {
    return <FormContext.Provider value={formState}>{children}</FormContext.Provider>;
  }

  const useFormField = <K extends keyof FormFields>(name: K) => {
    const formState = useContext(FormContext);
    if (!formState) {
      throw new Error('useFormField must be used within a FormProvider');
    }

    return formState.fields[name];
  };

  return {
    useFormState: (initialValues: InitialValues<FormFields>) =>
      useFormState<FormFields>({initialValues, validators}),
    FormProvider,
    useFormField,
  };
};
