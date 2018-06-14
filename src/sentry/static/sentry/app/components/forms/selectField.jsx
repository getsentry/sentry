import React from 'react';
import PropTypes from 'prop-types';

import FormField from 'app/components/forms/formField';
import SelectControl from 'app/components/forms/selectControl';

export default class SelectField extends FormField {
  static propTypes = {
    ...FormField.propTypes,
    options: SelectControl.propTypes.options,
    choices: SelectControl.propTypes.choices,
    clearable: SelectControl.propTypes.clearable,
    onChange: PropTypes.func,
    multiple: PropTypes.bool,
  };

  static defaultProps = {
    ...FormField.defaultProps,
    clearable: true,
    multiple: false,
  };

  isMultiple() {
    // this is to maintain compatibility with the 'multi' prop
    return this.props.multi || this.props.multiple;
  }

  getClassName() {
    return 'control-group';
  }

  onChange = opt => {
    const value = opt ? opt.value : null;
    this.setValue(value);
  };

  getField() {
    const {options, creatable, choices, placeholder, disabled, required} = this.props;

    return (
      <SelectControl
        creatable={creatable}
        id={this.getId()}
        choices={choices}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        value={this.state.value}
        onChange={this.onChange.bind(this)}
        clearable={this.props.clearable}
        multiple={this.isMultiple()}
      />
    );
  }
}
