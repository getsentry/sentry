import PropTypes from 'prop-types';
import React from 'react';

import {defined} from 'app/utils';

import InputField from 'app/components/forms/inputField';

export default class RadioBooleanField extends InputField {
  static propTypes = {
    ...InputField.propTypes,
    yesLabel: PropTypes.string.isRequired,
    noLabel: PropTypes.string.isRequired,
    yesFirst: PropTypes.bool,
  };

  static defaultProps = {
    ...InputField.defaultProps,
    yesLabel: 'Yes',
    noLabel: 'No',
    yesFirst: true,
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
    let yesOption = (
      <div className="radio" key="yes">
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
    );
    let noOption = (
      <div className="radio" key="no">
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
    );
    return (
      <div className="control-group radio-boolean">
        {this.props.yesFirst ? (
          <React.Fragment>
            {yesOption}
            {noOption}
          </React.Fragment>
        ) : (
          <React.Fragment>
            {noOption}
            {yesOption}
          </React.Fragment>
        )}
      </div>
    );
  }

  render() {
    let {label, hideErrorMessage, help, style} = this.props;
    let {error} = this.state;
    let cx = this.getFinalClassNames();
    let shouldShowErrorMessage = error && !hideErrorMessage;

    return (
      <div style={style} className={cx}>
        <div className="controls">
          {label && (
            <label htmlFor={this.getId()} className="control-label">
              {label}
            </label>
          )}
          {defined(help) && <p className="help-block">{help}</p>}
          {this.getField()}
          {this.renderDisabledReason()}
          {shouldShowErrorMessage && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }
}
