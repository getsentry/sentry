import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import isEqual from 'lodash/isEqual';

interface FormState<
  FormFields extends PlainValue,
  FieldErrors extends Record<keyof FormFields, any>,
> {
  /**
   * State for each field in the form.
   */
  fields: {
    [K in keyof FormFields]: {
      hasChanged: boolean;
      initialValue: FormFields[K];
      onChange: (value: React.SetStateAction<FormFields[K]>) => void;
      value: FormFields[K];
      error?: FieldErrors[K];
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

type PlainValue = AtomicValue | PlainArray | PlainObject;
interface PlainObject {
  [key: string]: PlainValue;
}
interface PlainArray extends Array<PlainValue> {}
type AtomicValue = string | number | boolean | null | undefined;

export type FormValidators<
  FormFields extends Record<string, PlainValue>,
  FieldErrors extends Record<keyof FormFields, any>,
> = {
  [K in keyof FormFields]?: (value: FormFields[K]) => FieldErrors[K] | undefined;
};

type InitialValues<FormFields extends Record<string, any>> = {
  [K in keyof FormFields]: FormFields[K];
};

type FormStateConfig<
  FormFields extends Record<string, PlainValue>,
  FieldErrors extends Record<keyof FormFields, any>,
> = {
  /**
   * The initial values for the form fields.
   */
  initialValues: InitialValues<FormFields>;
  /**
   * Whether to re-initialize the form state when the initial values change.
   */
  enableReInitialize?: boolean;
  /**
   * Validator functions for the form fields.
   */
  validators?: FormValidators<FormFields, FieldErrors>;
};

/**
 * Creates a form state object with fields and validation for a given set of form fields.
 */
export const useFormState = <
  FormFields extends Record<string, PlainValue>,
  FieldErrors extends Record<keyof FormFields, any>,
>(
  config: FormStateConfig<FormFields, FieldErrors>
): FormState<FormFields, FieldErrors> => {
  const [initialValues, setInitialValues] = useState(config.initialValues);
  const [validators] = useState(config.validators);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<{[K in keyof FormFields]?: FieldErrors[K]}>({});

  useEffect(() => {
    if (config.enableReInitialize) {
      setInitialValues(config.initialValues);
      setValues(config.initialValues);
      setErrors({});
    }
  }, [config.enableReInitialize, config.initialValues]);

  const setValue = useCallback(
    <K extends keyof FormFields>(name: K, value: React.SetStateAction<FormFields[K]>) => {
      setValues(old => ({
        ...old,
        [name]: typeof value === 'function' ? value(old[name]) : value,
      }));
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
      const validator = validators?.[name];
      return validator?.(value);
    },
    [validators]
  );

  const handleFieldChange = useCallback(
    <K extends keyof FormFields>(name: K, value: React.SetStateAction<FormFields[K]>) => {
      setValue(name, old => {
        const newValue = typeof value === 'function' ? value(old) : value;
        const error = validateField(name, newValue);
        setError(name, error);
        return newValue;
      });
    },
    [setError, setValue, validateField]
  );

  const changeHandlers = useMemo(() => {
    const result: {
      [K in keyof FormFields]: (value: React.SetStateAction<FormFields[K]>) => void;
    } = {} as any;

    for (const name in initialValues) {
      result[name] = (value: React.SetStateAction<FormFields[typeof name]>) =>
        handleFieldChange(name, value);
    }

    return result;
  }, [handleFieldChange, initialValues]);

  const fields = useMemo(() => {
    const result: FormState<FormFields, FieldErrors>['fields'] = {} as any;

    for (const name in initialValues) {
      result[name] = {
        value: values[name],
        onChange: changeHandlers[name],
        error: errors[name],
        hasChanged: values[name] !== initialValues[name],
        initialValue: initialValues[name],
      };
    }

    return result;
  }, [changeHandlers, errors, initialValues, values]);

  return {
    fields,
    isValid: Object.values(errors).every(error => !error),
    hasChanged: Object.entries(values).some(
      ([name, value]) => !isEqual(value, initialValues[name])
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
export const createForm = <
  FormFields extends Record<string, PlainValue>,
  FieldErrors extends Record<keyof FormFields, any> = Record<
    keyof FormFields,
    string | undefined
  >,
>({
  validators,
}: {
  validators?: FormValidators<FormFields, FieldErrors>;
}) => {
  const FormContext = createContext<FormState<FormFields, FieldErrors> | undefined>(
    undefined
  );

  function FormProvider({
    children,
    formState,
  }: {
    children: React.ReactNode;
    formState: FormState<FormFields, FieldErrors>;
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
    useFormState: (
      config: Omit<FormStateConfig<FormFields, FieldErrors>, 'validators'>
    ) => useFormState<FormFields, FieldErrors>({...config, validators}),
    FormProvider,
    useFormField,
  };
};
