import {useCallback, useContext, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import type {FormContextData} from 'sentry/components/deprecatedforms/formContext';
import FormContext from 'sentry/components/deprecatedforms/formContext';
import QuestionTooltip from 'sentry/components/questionTooltip';
import type {Meta} from 'sentry/types/group';
import {defined} from 'sentry/utils';

type Value = string | number | boolean;

type DefaultProps = {
  disabled?: boolean;
  hideErrorMessage?: boolean;
  required?: boolean;
};

export type FormFieldProps = DefaultProps & {
  name: string;
  className?: string;
  defaultValue?: any;
  disabledReason?: string;
  error?: string;
  help?: string | React.ReactNode;
  label?: React.ReactNode;
  meta?: Meta;
  onChange?: (value: Value) => void;
  style?: Record<PropertyKey, unknown>;
  value?: Value;
};

export type FormFieldRenderProps<T = Value> = {
  error: string | null;
  id: string;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setValue: (value: Value) => void;
  value: T;
  disabled?: boolean;
  required?: boolean;
};

export type FormFieldHookReturn<T = Value> = {
  error: string | null;
  getClassName: (customClassName?: string) => string;
  id: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  renderDisabledReason: () => React.ReactNode;
  renderField: (
    renderFunc: (props: FormFieldRenderProps<T>) => React.ReactNode
  ) => React.ReactNode;
  setValue: (value: Value) => void;
  value: T;
};

/**
 * A hook that provides form field functionality
 *
 * @deprecated Use the new form components instead
 */
export function useFormField<T = Value>({
  name,
  value: propValue,
  defaultValue,
  error: propError,
  onChange: propOnChange,
  disabled = false,
  required = false,
  hideErrorMessage = false,
  disabledReason,
  className,
  label,
  help,
  style,
  coerceValue = (val: any) => val as T,
  getClassName = () => 'control-group',
}: FormFieldProps & {
  coerceValue?: (value: any) => T;
  getClassName?: () => string;
}): FormFieldHookReturn<T> {
  const context = useContext<FormContextData>(FormContext);

  // Helper function to get value from props or context
  const getValueFromPropsOrContext = useCallback(
    (props: {name: string; defaultValue?: any; value?: Value}) => {
      const form = context?.form;

      if (defined(props.value)) {
        return props.value;
      }

      if (form?.data.hasOwnProperty(props.name)) {
        return defined(form.data[props.name]) ? form.data[props.name] : '';
      }

      return defined(props.defaultValue) ? props.defaultValue : '';
    },
    [context]
  );

  // Helper function to get error from props or context
  const getErrorFromPropsOrContext = useCallback(
    (props: {name: string; error?: string}) => {
      const form = context?.form;

      if (defined(props.error)) {
        return props.error;
      }

      return form?.errors[props.name] || null;
    },
    [context]
  );

  // Initialize state
  const [error, setError] = useState<string | null>(
    getErrorFromPropsOrContext({error: propError, name})
  );

  const [fieldValue, setFieldValue] = useState<Value>(() =>
    getValueFromPropsOrContext({value: propValue, defaultValue, name})
  );

  // Update error when props or context change
  useEffect(() => {
    const newError = getErrorFromPropsOrContext({error: propError, name});
    if (newError !== error) {
      setError(newError);
    }
  }, [propError, name, getErrorFromPropsOrContext, error]);

  // Update value when props or context change
  useEffect(() => {
    if (propValue !== undefined || defined(context?.form)) {
      const newValue = getValueFromPropsOrContext({value: propValue, defaultValue, name});
      if (newValue !== fieldValue) {
        setFieldValue(newValue);
      }
    }
  }, [propValue, defaultValue, name, context, getValueFromPropsOrContext, fieldValue]);

  // Generate ID for the field
  const id = useMemo(() => `id-${name}`, [name]);

  // Set value and notify parent/form
  const setValue = useCallback(
    (value: Value) => {
      const finalValue = coerceValue(value);
      setFieldValue(finalValue as Value);
      if (Array.isArray(finalValue) && finalValue.length === 1) {
        propOnChange?.(finalValue[0] as Value);
      } else {
        propOnChange?.(finalValue as Value);
      }

      // Only call onFieldChange if finalValue is not null
      if (finalValue === null) {
        // For null values, pass an empty string to the form
        context?.form?.onFieldChange(name, '');
      } else {
        context?.form?.onFieldChange(name, finalValue as string | number);
      }
    },
    [coerceValue, context?.form, name, propOnChange]
  );

  // Handle input change
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> | any) => {
      const value = e?.target?.value ?? e;
      // Use setValue instead of directly setting the field value
      // This ensures the value goes through coerceValue
      setValue(value);
    },
    [setValue]
  );

  // Get final class names
  const getFinalClassNames = useCallback(
    (customClassName?: string) => {
      return classNames(customClassName || className, getClassName(), {
        'has-error': !!error,
        required,
      });
    },
    [className, error, getClassName, required]
  );

  // Render disabled reason tooltip if needed
  const renderDisabledReason = useCallback(() => {
    if (!disabled || !disabledReason) {
      return null;
    }
    return <QuestionTooltip title={disabledReason} position="top" size="sm" />;
  }, [disabled, disabledReason]);

  // Render the field with the provided render function
  const renderField = useCallback(
    (renderFunc: (props: FormFieldRenderProps<T>) => React.ReactNode) => {
      const cx = getFinalClassNames();
      const shouldShowErrorMessage = error && !hideErrorMessage;

      return (
        <div style={style} className={cx}>
          <div className="controls">
            {label && (
              <label htmlFor={id} className="control-label">
                {label}
              </label>
            )}
            {renderFunc({
              error,
              id,
              name,
              value: fieldValue as T,
              onChange,
              setValue,
              disabled,
              required,
            })}
            {renderDisabledReason()}
            {defined(help) && <p className="help-block">{help}</p>}
            {shouldShowErrorMessage && <ErrorMessage>{error}</ErrorMessage>}
          </div>
        </div>
      );
    },
    [
      getFinalClassNames,
      error,
      hideErrorMessage,
      style,
      label,
      id,
      name,
      fieldValue,
      onChange,
      setValue,
      disabled,
      required,
      renderDisabledReason,
      help,
    ]
  );

  return {
    error,
    value: fieldValue as T,
    id,
    onChange,
    setValue,
    renderField,
    renderDisabledReason,
    getClassName: getFinalClassNames,
  };
}

const ErrorMessage = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.errorText};
`;
