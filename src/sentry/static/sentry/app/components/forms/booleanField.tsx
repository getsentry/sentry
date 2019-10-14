import React from 'react';

import {defined} from 'app/utils';

import InputField from 'app/components/forms/inputField';
import Tooltip from 'app/components/tooltip';

type Props = InputField['props'];

type State = InputField['state'] & {
  value: boolean;
};

export default class BooleanField extends InputField<Props, State> {
  coerceValue(initialValue: string | number) {
    const value = super.coerceValue(initialValue);
    return value ? true : false;
  }

  onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    this.setValue(value);
  };

  getField() {
    return (
      <input
        id={this.getId()}
        type={this.getType()}
        checked={this.state.value}
        onChange={this.onChange.bind(this)}
        disabled={this.props.disabled}
      />
    );
  }

  render() {
    const {error} = this.state;
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
            {this.props.disabled && this.props.disabledReason && (
              <Tooltip title={this.props.disabledReason}>
                <span className="icon-question" />
              </Tooltip>
            )}
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
