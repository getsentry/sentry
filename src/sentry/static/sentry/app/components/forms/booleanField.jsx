import React from 'react';

import {defined} from '../../utils';

import InputField from './inputField';

export default class BooleanField extends InputField {
  valueFromProps(props) {
    let value = super.valueFromProps(props);
    return value ? true : false;
  }

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
          onChange={this.onChange.bind(this)}
          disabled={this.props.disabled}
          defaultChecked={this.state.value} />
    );
  }


  render() {
    let className = this.getClassName();
    if (this.props.error) {
      className += ' has-error';
    }
    return (
      <div className={className}>
        <div className="controls">
          <label className="control-label">
            {this.getField()}
            {this.props.label}
            {this.props.disabled && this.props.disabledReason &&
              <span className="disabled-indicator tip" title={this.props.disabledReason}>
                <span className="icon-question" />
              </span>
            }
          </label>
          {defined(this.props.help) &&
            <p className="help-block">{this.props.help}</p>
          }
          {this.props.error &&
            <p className="error">{this.props.error}</p>
          }
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
