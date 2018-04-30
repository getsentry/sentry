import React from 'react';
import PropTypes from 'prop-types';

import FormField from 'app/components/forms/formField';
import SelectControl from 'app/components/forms/selectControl';

export default class SelectField extends FormField {
  static propTypes = {
    ...FormField.propTypes,
    options: PropTypes.array.isRequired,
    onChange: PropTypes.func,
    clearable: PropTypes.bool,
  };

  static defaultProps = {
    ...FormField.defaultProps,
    clearable: true,
  };

  getClassName() {
    return '';
  }

  onChange = opt => {
    const value = opt ? opt.value : null;
    this.setValue(value);
  };

  getField() {
    const {options, placeholder, disabled, required} = this.props;

    return (
      <SelectControl
        id={this.getId()}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        value={this.state.value}
        onChange={this.onChange.bind(this)}
        clearable={this.props.clearable}
      />
    );
  }
}
