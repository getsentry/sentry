import React from 'react';
import InputField from './inputField';

export default class NumberField extends InputField {
  static propTypes = {
    ...InputField.propTypes,
    min: React.PropTypes.number,
    max: React.PropTypes.number
  };

  coerceValue(value) {
    return parseInt(value, 10);
  }

  getType() {
    return 'number';
  }

  getAttributes() {
    return {
      min: this.props.min || undefined,
      max: this.props.max || undefined
    };
  }
}
