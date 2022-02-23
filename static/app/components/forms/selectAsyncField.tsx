import * as React from 'react';

import InputField from 'sentry/components/forms/inputField';
import SelectAsyncControl, {Result} from 'sentry/components/forms/selectAsyncControl';

// projects can be passed as a direct prop as well
type Props = Omit<InputField['props'], 'highlighted' | 'visible' | 'required'>;
import {GeneralSelectValue} from 'sentry/components/forms/selectControl';

export type SelectAsyncFieldProps = React.ComponentPropsWithoutRef<
  typeof SelectAsyncControl
> &
  Props;

type SelectAsyncFieldState = {
  results: Result[];
  latestSelection?: GeneralSelectValue;
};
class SelectAsyncField extends React.Component<
  SelectAsyncFieldProps,
  SelectAsyncFieldState
> {
  state = {
    results: [],
    latestSelection: undefined,
  };

  componentDidMount() {}

  // need to map the option object to the value
  // this is essentially the same code from ./selectField handleChange()
  handleChange = (
    onBlur: Props['onBlur'],
    onChange: Props['onChange'],
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
      latestSelection
    );
  }

  render() {
    const {...otherProps} = this.props;
    return (
      <InputField
        {...otherProps}
        field={({onChange, onBlur, required: _required, onResults, value, ...props}) => (
          <SelectAsyncControl
            {...props}
            onChange={this.handleChange.bind(this, onBlur, onChange)}
            onResults={data => {
              const results = onResults(data);
              const resultSelection = results.find(result => result.value === value);
              this.setState(
                resultSelection
                  ? {
                      results,
                      latestSelection: resultSelection,
                    }
                  : {results}
              );
              return results;
            }}
            onSelectResetsInput
            onCloseResetsInput={false}
            onBlurResetsInput={false}
            value={this.findValue(value)}
          />
        )}
      />
    );
  }
}

export default SelectAsyncField;
