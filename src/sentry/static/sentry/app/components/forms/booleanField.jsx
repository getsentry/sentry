import React from 'react';
import InputField from './inputField';

export default class BooleanField extends InputField {
  onChange(e) {
    this.setState({
      value: e.target.checked,
    }, () => {
      this.props.onChange(this.state.value);
    });
  }

  getField() {
    return (
      <input id={this.getId()}
          type={this.getType()}
          style={{marginLeft: '10px'}}
          onChange={this.onChange}
          disabled={this.props.disabled}
          defaultChecked={this.state.value} />
    );
  }

  getType() {
    return 'checkbox';
  }
}
