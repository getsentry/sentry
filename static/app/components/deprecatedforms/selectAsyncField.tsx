import {useCallback, useContext} from 'react';

import {SelectAsync} from 'sentry/components/core/select/async';
import FormContext from 'sentry/components/deprecatedforms/formContext';
import {
  type FormFieldProps,
  useFormField,
} from 'sentry/components/deprecatedforms/formField';
import {selectUtils} from 'sentry/components/deprecatedforms/selectField';

type Props = FormFieldProps & {
  // SelectAsync props
  choices?: Array<{label: string; value: string | number}>;
  clearable?: boolean;
  creatable?: boolean;
  defaultOptions?: boolean;
  isLoading?: boolean;
  multi?: boolean;
  multiple?: boolean;
  options?: Array<{label: string; value: string | number}>;
  placeholder?: string;
  url?: string;
};

/**
 * @deprecated Do not use this
 */
function SelectAsyncField({
  placeholder = 'Start typing to search for an issue',
  clearable = true,
  multiple = false,
  multi = false,
  ...props
}: Props) {
  // Determine if multiple selection is enabled
  const isMultiple = multiple || multi;

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

  // Function to transform API results
  const onResults = useCallback(
    (data: any) => {
      const {name} = props;
      const results = data?.[name];

      return results?.map(({id, text}: any) => ({value: id, label: text})) || [];
    },
    [props]
  );

  // Function to build query parameters
  const onQuery = useCallback(
    (query: any) => ({
      autocomplete_query: query,
      autocomplete_field: props.name,
    }),
    [props]
  );

  return field.renderField(({id, name, value, onChange, disabled, required}) => {
    // Destructure name from props to avoid duplicate prop
    const {name: _, ...restProps} = props;

    // Format the value for the select component using the shared utility
    const formattedValue = selectUtils.formatValue(value, isMultiple);

    return (
      <SelectAsync
        id={id}
        name={name}
        onResults={onResults}
        onQuery={onQuery}
        {...restProps}
        value={formattedValue}
        onChange={onChange}
        disabled={disabled}
        required={required}
        clearable={clearable}
        multiple={isMultiple}
        placeholder={placeholder}
      />
    );
  });
}

export default SelectAsyncField;
