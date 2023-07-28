import {useState} from 'react';

import SelectAsyncControl, {
  Result,
  SelectAsyncControlProps,
} from 'sentry/components/forms/controls/selectAsyncControl';
// projects can be passed as a direct prop as well
import {GeneralSelectValue} from 'sentry/components/forms/controls/selectControl';
import FormField from 'sentry/components/forms/formField';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import {InputFieldProps} from './inputField';

export interface SelectAsyncFieldProps
  extends Omit<InputFieldProps, 'highlighted' | 'visible' | 'required' | 'value'>,
    SelectAsyncControlProps {
  /**
   * Similar to onChange, except it provides the entire option object (including label) when a
   * change is made to the field. Occurs after onChange.
   */
  onChangeOption?: (option: GeneralSelectValue, event: any) => void;
}

function SelectAsyncField({onChangeOption, ...props}: SelectAsyncFieldProps) {
  const [results, setResults] = useState<Result[]>([]);
  const [latestSelection, setLatestSelection] = useState<
    GeneralSelectValue | undefined
  >();

  return (
    <FormField {...props}>
      {({
        required: _required,
        children: _children,
        onBlur,
        onChange,
        onResults,
        value,
        ...fieldProps
      }) => {
        const {defaultOptions} = props;
        // We don't use defaultOptions if it is undefined or a boolean
        const options = typeof defaultOptions === 'object' ? defaultOptions : [];
        // The propsValue is the `id` of the object (user, team, etc), and
        // react-select expects a full value object: {value: "id", label: "name"}
        const resolvedValue =
          // When rendering the selected value, first look at the API results...
          results.find(({value: v}) => v === value) ??
          // Then at the defaultOptions passed in props...
          options?.find(({value: v}) => v === value) ??
          // Then at the latest value selected in the form
          (latestSelection as GeneralSelectValue);

        return (
          <SelectAsyncControl
            {...fieldProps}
            onChange={(option, e) => {
              const resultValue = !option
                ? option
                : props.multiple && Array.isArray(option)
                ? // List of optionObjs
                  option.map(({value: val}) => val)
                : !Array.isArray(option)
                ? option.value
                : option;

              setLatestSelection(option);
              onChange?.(resultValue, e);
              onChangeOption?.(option, e);
              onBlur?.(resultValue, e);
            }}
            onResults={data => {
              const newResults = onResults(data);
              const resultSelection = newResults.find(result => result.value === value);

              setResults(newResults);
              if (resultSelection) {
                setLatestSelection(resultSelection);
              }

              return newResults;
            }}
            onSelectResetsInput
            onCloseResetsInput={false}
            onBlurResetsInput={false}
            value={resolvedValue}
          />
        );
      }}
    </FormField>
  );
}

export default SelectAsyncField;
