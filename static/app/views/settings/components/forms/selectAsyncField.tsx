import * as React from 'react';

import SelectAsyncControl, {
  Props as SelectAsyncControlProps,
} from 'app/components/forms/selectAsyncControl';
import InputField from 'app/views/settings/components/forms/inputField';

//projects can be passed as a direct prop as well
type Props = InputField['props'];

type SelectAsyncFieldProps = SelectAsyncControlProps & Props;

class SelectAsyncField extends React.Component<SelectAsyncFieldProps> {
  state = {
    results: [],
    value: {},
  };
  //need to map the option object to the value
  handleChange = (
    onBlur: Props['onBlur'],
    onChange: Props['onChange'],
    optionObj: {value: any},
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
    onChange?.(value, event);
    onBlur?.(value, event);
  };

  findValue(propsValue) {
    return this.state.results.find(({value}) => value === propsValue) || propsValue;
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
              this.setState({results});
              return results;
            }}
            value={this.findValue(value)}
          />
        )}
      />
    );
  }
}

export default SelectAsyncField;
