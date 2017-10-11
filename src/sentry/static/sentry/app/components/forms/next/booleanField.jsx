import React from 'react';

import InputField from './inputField';
import Switch from '../../switch';

export default class BooleanField extends InputField {
  coerceValue(value) {
    return value ? true : false;
  }

  onChange = (value, onChange, onBlur, e) => {
    // We need to toggle current value because Switch is not an input
    let newValue = this.coerceValue(!value);
    onChange(newValue, e);
    onBlur(newValue, e);
  };

  render() {
    return (
      <InputField
        {...this.props}
        field={({onChange, onBlur, value, disabled, ...props}) => (
          <Switch
            size="lg"
            {...props}
            isActive={value}
            isDisabled={disabled}
            toggle={this.onChange.bind(this, value, onChange, onBlur)}
          />
        )}
      />
    );
  }
}
