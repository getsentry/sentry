import {Component} from 'react';

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

type SelectAsyncFieldState = {
  results: Result[];
  latestSelection?: GeneralSelectValue;
};
class SelectAsyncField extends Component<SelectAsyncFieldProps, SelectAsyncFieldState> {
  state: SelectAsyncFieldState = {
    results: [],
    latestSelection: undefined,
  };

  componentDidMount() {}

  // need to map the option object to the value
  // this is essentially the same code from ./selectField handleChange()
  handleChange = (
    onBlur: SelectAsyncFieldProps['onBlur'],
    onChange: SelectAsyncFieldProps['onChange'],
    onChangeOption: SelectAsyncFieldProps['onChangeOption'],
    optionObj: GeneralSelectValue,
    event: React.MouseEvent
  ) => {
    let {value} = optionObj;
    if (!optionObj) {
      value = optionObj;
    } else if (this.props.multiple && Array.isArray(optionObj)) {
      // List of optionObjs
      value = optionObj.map(({value: val}) => val);
    } else if (!Array.isArray(optionObj)) {
      value = optionObj.value;
    }
    this.setState({latestSelection: optionObj});
    onChange?.(value, event);
    onChangeOption?.(optionObj, event);
    onBlur?.(value, event);
  };

  findValue(propsValue: string): GeneralSelectValue {
    const {defaultOptions} = this.props;
    const {results, latestSelection} = this.state;
    // We don't use defaultOptions if it is undefined or a boolean
    const options = typeof defaultOptions === 'object' ? defaultOptions : [];
    /**
     * The propsValue is the `id` of the object (user, team, etc), and
     * react-select expects a full value object: {value: "id", label: "name"}
     **/
    return (
      // When rendering the selected value, first look at the API results...
      results.find(({value}) => value === propsValue) ??
      // Then at the defaultOptions passed in props...
      options?.find(({value}) => value === propsValue) ??
      // Then at the latest value selected in the form
      (latestSelection as GeneralSelectValue)
    );
  }

  render() {
    const {onChangeOption, ...otherProps} = this.props;
    return (
      <FormField {...otherProps}>
        {({
          required: _required,
          children: _children,
          onBlur,
          onChange,
          onResults,
          value,
          ...props
        }) => (
          <SelectAsyncControl
            {...props}
            onChange={this.handleChange.bind(this, onBlur, onChange, onChangeOption)}
            onResults={data => {
              const results = onResults(data);
              const resultSelection = results.find(result => result.value === value);
              this.setState(
                resultSelection ? {results, latestSelection: resultSelection} : {results}
              );
              return results;
            }}
            onSelectResetsInput
            onCloseResetsInput={false}
            onBlurResetsInput={false}
            value={this.findValue(value)}
          />
        )}
      </FormField>
    );
  }
}

export default SelectAsyncField;
