import {useCallback, useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import {StyledForm} from 'sentry/components/deprecatedforms/form';
import FormContext from 'sentry/components/deprecatedforms/formContext';
import {
  type FormFieldProps,
  useFormField,
} from 'sentry/components/deprecatedforms/formField';
import {selectUtils} from 'sentry/components/deprecatedforms/selectField';
import type {SelectValue} from 'sentry/types/core';
import convertFromSelect2Choices from 'sentry/utils/convertFromSelect2Choices';

type Props = FormFieldProps & {
  // Select props
  choices?: Array<{label: string; value: string | number}> | string[] | string[][];
  clearable?: boolean;
  disabled?: boolean;
  multi?: boolean;
  multiple?: boolean;
  options?: Array<SelectValue<any>>;
  placeholder?: string;
};

// XXX: This is ONLY used in GenericField. If we can delete that this can go.

/**
 * @deprecated Do not use this
 *
 * This is a select field that allows the user to create new options if one doesn't exist.
 *
 * This is used in some integrations
 */
function SelectCreatableField({
  clearable = true,
  multiple = false,
  multi = false,
  choices,
  options: propOptions,
  ...props
}: Props) {
  // Determine if multiple selection is enabled
  const isMultiple = multiple || multi;

  // Parse options once because react-select relies on `options` mutation
  // when you create a new option
  const options = useMemo(() => {
    return convertFromSelect2Choices(choices) || propOptions;
  }, [choices, propOptions]);

  // Coerce value for the form using the shared utility
  const coerceValue = useCallback(
    (value: any) => {
      return selectUtils.createCoerceValue(isMultiple)(value);
    },
    [isMultiple]
  );

  // Get form field functionality
  const field = useFormField({
    ...props,
    // Override getClassName to match SelectField
    getClassName: () => '',
    coerceValue,
  });

  // Use the custom hook to handle special value comparison logic
  const context = useContext(FormContext);
  selectUtils.useSelectValueSync(field.value, field.setValue, context);

  return field.renderField(({id, name, value, onChange, disabled, required}) => {
    // Destructure props to avoid duplicates
    const {name: _, disabled: __, placeholder, ...restProps} = props;

    // Format the value for the select component using the shared utility
    const formattedValue = selectUtils.formatValue(value, isMultiple);

    return (
      <StyledSelectControl
        creatable
        id={id}
        name={name}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        value={formattedValue}
        onChange={onChange}
        clearable={clearable}
        multiple={isMultiple}
        {...restProps}
      />
    );
  });
}

// This is because we are removing `control-group` class name which provides margin-bottom
const StyledSelectControl = styled(Select)`
  ${StyledForm} &, .form-stacked & {
    .control-group & {
      margin-bottom: 0;
    }

    margin-bottom: 15px;
  }
`;

export default SelectCreatableField;
