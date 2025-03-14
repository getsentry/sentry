import {useCallback, useContext, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import type {ControlProps} from 'sentry/components/core/select';
import {Select} from 'sentry/components/core/select';
import FormContext from 'sentry/components/deprecatedforms/formContext';
import {
  type FormFieldProps,
  useFormField,
} from 'sentry/components/deprecatedforms/formField';
import {defined} from 'sentry/utils';

import {StyledForm} from './form';

type SelectProps = Omit<ControlProps, 'onChange' | 'name'>;
type Props = FormFieldProps & SelectProps;

// Utility functions for select fields
export const selectUtils = {
  // Create a coerceValue function based on whether multiple selection is enabled
  createCoerceValue: (isMultiple: boolean) => {
    return (value: any) => {
      if (!value) {
        return '';
      }

      if (isMultiple) {
        return value.map((v: any) => v.value);
      }

      if (value?.hasOwnProperty?.('value')) {
        return value.value;
      }

      return value;
    };
  },

  // Format a value for display in a select component
  formatValue: (value: any, isMultiple: boolean) => {
    if (!value) {
      return isMultiple ? [] : null;
    }

    // If it's already in the format that react-select expects, return it
    if (value?.hasOwnProperty?.('value')) {
      return value;
    }

    if (isMultiple) {
      if (!Array.isArray(value)) {
        return [];
      }

      return value.map(val => {
        if (val?.hasOwnProperty?.('value')) {
          return val;
        }
        return {value: val, label: val};
      });
    }

    return {value, label: value};
  },

  // Get default value based on whether it's a multiple select
  getDefaultValue: (
    isMultiple: boolean,
    fieldProps: {name: string; defaultValue?: any; value?: any}
  ) => {
    const defaultEmptyValue = isMultiple ? [] : '';

    if (fieldProps.value !== undefined) {
      return fieldProps.value;
    }

    return fieldProps.defaultValue === undefined
      ? defaultEmptyValue
      : fieldProps.defaultValue;
  },

  // Custom hook to handle the special value comparison logic from the class component
  useSelectValueSync: (
    propValue: any,
    value: any,
    setValue: (value: any) => void,
    formContext: any
  ) => {
    // Keep track of the previous value for comparison
    const prevPropValueRef = useRef<any>(null);
    const prevValueRef = useRef<any>(null);

    useEffect(() => {
      // Skip the first render
      if (prevPropValueRef.current === null) {
        prevPropValueRef.current = propValue;
        return;
      }

      if (prevValueRef.current === null) {
        prevValueRef.current = value;
        return;
      }

      // This mimics the UNSAFE_componentWillReceiveProps logic
      if (prevValueRef.current !== value || defined(formContext?.form)) {
        // Update refs for next comparison
        prevValueRef.current = value;
        prevPropValueRef.current = propValue;
        setValue(value);
      }
    }, [propValue, value, setValue, formContext]);
  },
};

/**
 * @deprecated Do not use this
 */
function SelectField({
  clearable = true,
  multiple = false,
  multi = false,
  options,
  creatable,
  choices,
  placeholder,
  disabled,
  isLoading,
  ...props
}: Props) {
  // Determine if multiple selection is enabled
  const isMultiple = useMemo(() => multi || multiple, [multi, multiple]);

  // Get default value based on whether it's a multiple select
  const getDefaultValue = useCallback(
    (fieldProps: {name: string; defaultValue?: any; value?: any}) => {
      return selectUtils.getDefaultValue(isMultiple, fieldProps);
    },
    [isMultiple]
  );

  // Coerce value for the form
  const coerceValue = useCallback(
    (value: any) => {
      return selectUtils.createCoerceValue(isMultiple)(value);
    },
    [isMultiple]
  );

  // Get form field functionality
  const field = useFormField({
    ...props,
    getClassName: () => '',
    coerceValue,
    defaultValue: getDefaultValue({
      value: props.value,
      defaultValue: props.defaultValue,
      name: props.name,
    }),
  });

  // Use the custom hook to handle special value comparison logic
  const context = useContext(FormContext);
  selectUtils.useSelectValueSync(props.value, field.value, field.setValue, context);

  return field.renderField(
    ({id, name, value, onChange, disabled: fieldDisabled, required}) => {
      // Destructure props to avoid duplicates
      const {name: _, ...restProps} = props;

      // Format the value for the select component using the shared utility
      const formattedValue = selectUtils.formatValue(value, isMultiple);

      return (
        <StyledSelectControl
          creatable={creatable}
          inputId={id}
          choices={choices}
          options={options}
          placeholder={placeholder}
          disabled={disabled || fieldDisabled}
          required={required}
          clearable={clearable}
          multiple={isMultiple}
          name={name}
          isLoading={isLoading}
          {...restProps}
          onChange={onChange}
          value={formattedValue}
        />
      );
    }
  );
}

// This is to match other fields that are wrapped by a `div.control-group`
const StyledSelectControl = styled(Select)`
  ${StyledForm} &, .form-stacked & {
    .control-group & {
      margin-bottom: 0;
    }

    margin-bottom: 15px;
  }
`;

export default SelectField;
