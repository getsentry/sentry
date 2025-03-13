import {useCallback} from 'react';

import {
  type FormFieldProps,
  type FormFieldRenderProps,
  useFormField,
} from 'sentry/components/deprecatedforms/formField';

export type InputFieldProps = FormFieldProps & {
  autoComplete?: string;
  inputStyle?: Record<PropertyKey, unknown>;
  min?: number;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyPress?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: number;
};

// XXX: This is ONLY used in GenericField. If we can delete that this can go.

/**
 * A hook that provides input field functionality
 *
 * @deprecated Do not use this
 */
export function useInputField<T = string | number>({
  type,
  ...props
}: InputFieldProps & {
  type: string;
  coerceValue?: (value: any) => T;
}) {
  const getClassName = useCallback(() => 'control-group', []);

  const field = useFormField({
    ...props,
    getClassName,
  });

  // Render the input field
  const renderInputField = useCallback(
    (customProps?: Partial<FormFieldRenderProps<T>>) => {
      return field.renderField(fieldProps => {
        const {id, name, value, onChange, disabled, required} = {
          ...fieldProps,
          ...customProps,
        };

        // For number inputs, we need to convert null to empty string
        // and ensure we're not passing 'null' as a string
        const displayValue = value === null ? '' : value;

        return (
          <input
            id={id}
            type={type}
            className="form-control"
            autoComplete={props.autoComplete}
            placeholder={props.placeholder}
            onChange={onChange}
            disabled={disabled}
            name={name}
            required={required}
            value={displayValue as string | number} // can't pass in boolean here
            style={props.inputStyle}
            onBlur={props.onBlur}
            onFocus={props.onFocus}
            onKeyPress={props.onKeyPress}
            onKeyDown={props.onKeyDown}
            min={props.min}
            step={props.step}
          />
        );
      });
    },
    [
      field,
      type,
      props.autoComplete,
      props.placeholder,
      props.inputStyle,
      props.onBlur,
      props.onFocus,
      props.onKeyPress,
      props.onKeyDown,
      props.min,
      props.step,
    ]
  );

  return {
    ...field,
    renderInputField,
  };
}

/**
 * A utility function to create an input field component
 *
 * @deprecated Do not use this
 */
export function createInputField(type: string) {
  return function InputFieldComponent(props: InputFieldProps) {
    const field = useInputField({
      ...props,
      type,
    });

    return field.renderInputField();
  };
}

export default useInputField;
