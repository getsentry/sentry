import * as React from 'react';

import SelectAsyncControl from 'app/components/forms/selectAsyncControl';
import InputField from 'app/views/settings/components/forms/inputField';

// projects can be passed as a direct prop as well
type Props = Omit<InputField['props'], 'highlighted' | 'visible' | 'required'>;

export type SelectAsyncFieldProps = React.ComponentPropsWithoutRef<
  typeof SelectAsyncControl
> &
  Props;

class SelectAsyncField extends React.Component<SelectAsyncFieldProps> {
  state = {
    results: [],
  };
  // need to map the option object to the value
  // this is essentially the same code from ./selectField handleChange()
  handleChange = (
    onBlur: Props['onBlur'],
    onChange: Props['onChange'],
    optionObj: {value: string | any[]},
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
    /**
     * The propsValue is the `id` of the object (user, team, etc), and
     * react-select expects a full value object: {value: "id", label: "name"}
     *
     * Returning {} here will show the user a dropdown with "No options".
     **/
    return this.state.results.find(({value}) => value === propsValue) || {};
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
