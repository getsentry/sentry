import React from 'react';
import InputField from './inputField';

export default class TextareaField extends InputField {
  getField() {
    return (
      <textarea {...this.props}
          id={this.getId()}
          className="form-control"
          value={this.state.value}
          onChange={this.onChange.bind(this)} />
    );
  }
}
