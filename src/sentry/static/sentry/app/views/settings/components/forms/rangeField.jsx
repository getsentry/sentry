import React from 'react';

import InputField from 'app/views/settings/components/forms/inputField';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';

export default class RangeField extends React.Component {
  static defaultProps = {
    formatMessageValue: (value, props) =>
      (typeof props.formatLabel === 'function' && props.formatLabel(value)) || value,
  };

  onChange = (onChange, _onBlur, value, e) => {
    // We need to toggle current value because Switch is not an input
    onChange(value, e);
    // onBlur(value, e);
  };

  render() {
    return (
      <InputField
        {...this.props}
        field={({onChange, onBlur, value, ...props}) => (
          <RangeSlider
            {...props}
            value={value}
            onBlur={onBlur}
            onChange={this.onChange.bind(this, onChange, onBlur)}
          />
        )}
      />
    );
  }
}
