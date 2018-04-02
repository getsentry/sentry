import React from 'react';
import PropTypes from 'prop-types';

import InputField from './inputField';

export default class RadioBooleanField extends InputField {
  static propTypes = {
    ...InputField.propTypes,
    yesLabel: PropTypes.string.isRequired,
    noLabel: PropTypes.string.isRequired,
  };

  coerceValue(props) {
    let value = super.coerceValue(props);
    return value ? true : false;
  }

  onChange = e => {
    let value = e.target.value === 'true';
    this.setValue(value);
  };

  getType() {
    return 'radio';
  }

  getField() {
    return (
      <div className="control-group">
        <div className="radio">
          <label style={{fontWeight: 'normal'}}>
            <input
              type="radio"
              value="true"
              name={this.props.name}
              checked={this.state.value === true}
              onChange={this.onChange.bind(this)}
              disabled={this.props.disabled}
            />{' '}
            {this.props.yesLabel}
          </label>
        </div>
        <div className="radio">
          <label style={{fontWeight: 'normal'}}>
            <input
              type="radio"
              name={this.props.name}
              value="false"
              checked={this.state.value === false}
              onChange={this.onChange.bind(this)}
              disabled={this.props.disabled}
            />{' '}
            {this.props.noLabel}
          </label>
        </div>
      </div>
    );
  }
}
