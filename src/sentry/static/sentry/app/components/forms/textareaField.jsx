import React from 'react';
import InputField from 'app/components/forms/inputField';

export default class TextareaField extends InputField {
  getField() {
    return (
      <textarea
        id={this.getId()}
        className="form-control"
        value={this.state.value}
        disabled={this.props.disabled}
        required={this.props.required}
        placeholder={this.props.placeholder}
        onChange={this.onChange.bind(this)}
        {...this.getAttributes}
      />
    );
  }
}
