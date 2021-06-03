import * as React from 'react';

import SelectAsyncControl, {
  Props as SelectAsyncControlProps,
} from 'app/components/forms/selectAsyncControl';
import InputField from 'app/views/settings/components/forms/inputField';

//projects can be passed as a direct prop as well
type Props = InputField['props'];

export type SelectAsyncFieldProps = SelectAsyncControlProps & Props;

class SelectAsyncField extends React.Component<SelectAsyncFieldProps> {
  state = {
    results: [],
  };
  //need to map the option object to the value
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
     * When this component first loads, this.state.results will get set to the
     * first 100 results from the API.
     *
     * The propsValue is the `id` of the object (user, team, etc), and so if that
     * `id` doesn't match the first 100 results, react-select won't be able to
     *  return the full value object: {value: "id", label: "name"}
     *
     * We return {} here instead of the propsValue (the `id`) because react-select
     * expects there to be an object and there seems to be weirdness if it isn't.
     * This will affect large orgs who are editing form fields that may have saved
     * data outside of the first 100 results. :(
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
