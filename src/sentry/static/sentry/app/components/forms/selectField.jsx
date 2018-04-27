import React from 'react';
import PropTypes from 'prop-types';

import FormField from './formField';
import StyledSelect from './select.styled';

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

  renderArrow = () => {
    return <span className="icon-arrow-down" />;
  };

  getField() {
    const {options, placeholder, disabled, required} = this.props;

    return (
      <StyledSelect
        id={this.getId()}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        value={this.state.value}
        arrowRenderer={this.renderArrow}
        onChange={this.onChange.bind(this)}
        clearable={this.props.clearable}
      />
    );
  }
}
