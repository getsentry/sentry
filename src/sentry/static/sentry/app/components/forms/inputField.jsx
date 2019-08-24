import PropTypes from 'prop-types';
import React from 'react';

import FormField from 'app/components/forms/formField';

export default class InputField extends FormField {
  static propTypes = {
    ...FormField.propTypes,
    placeholder: PropTypes.string,
  };

  getAttributes() {
    return {};
  }

  getField() {
    return (
      <input
        id={this.getId()}
        type={this.getType()}
        className="form-control"
        placeholder={this.props.placeholder}
        onChange={this.onChange}
        disabled={this.props.disabled}
        name={this.props.name}
        required={this.props.required}
        value={this.state.value}
        style={this.props.inputStyle}
        {...this.getAttributes()}
      />
    );
  }

  getClassName() {
    return 'control-group';
  }

  getType() {
    throw new Error('Must be implemented by child.');
  }
}
