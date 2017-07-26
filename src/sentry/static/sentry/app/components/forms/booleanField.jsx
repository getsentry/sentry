import React from 'react';

import {defined} from '../../utils';

import InputField from './inputField';

export default class BooleanField extends InputField {
  coerceValue(props) {
    let value = super.coerceValue(props);
    return value ? true : false;
  }

  onChange = e => {
    let value = e.target.checked;
    this.setValue(value);
  };

  getField() {
    return (
      <input
        id={this.getId()}
        type={this.getType()}
        onChange={this.onChange.bind(this)}
        disabled={this.props.disabled}
        defaultChecked={this.state.value}
      />
    );
  }

  render() {
    let error = this.getError();
    let className = this.getClassName();
    if (error) {
      className += ' has-error';
    }
    return (
      <div className={className}>
        <div className="controls">
          <label className="control-label">
            {this.getField()}
            {this.props.label}
            {this.props.disabled &&
              this.props.disabledReason &&
              <span className="disabled-indicator tip" title={this.props.disabledReason}>
                <span className="icon-question" />
              </span>}
          </label>
          {defined(this.props.help) && <p className="help-block">{this.props.help}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  getClassName() {
    return 'control-group checkbox';
  }

  getType() {
    return 'checkbox';
  }
}
