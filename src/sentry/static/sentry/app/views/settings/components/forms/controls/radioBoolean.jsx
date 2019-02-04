import PropTypes from 'prop-types';
import React from 'react';

class Option extends React.Component {
  static propTypes = {
    name: PropTypes.string,
    label: PropTypes.node,
    value: PropTypes.string,
    checked: PropTypes.bool,
    disabled: PropTypes.bool,
    onChange: PropTypes.func,
  };

  handleChange = e => {
    const {onChange} = this.props;
    const value = e.target.value === 'true';

    if (typeof onChange === 'function') {
      onChange(value, e);
    }
  };
  render() {
    const {name, disabled, label, value, checked} = this.props;

    return (
      <div className="radio">
        <label style={{fontWeight: 'normal'}}>
          <input
            type="radio"
            value={value}
            name={name}
            checked={checked}
            onChange={this.handleChange}
            disabled={disabled}
          />{' '}
          {label}
        </label>
      </div>
    );
  }
}

export default class RadioBoolean extends React.Component {
  static propTypes = {
    disabled: PropTypes.bool,
    name: PropTypes.string,
    yesLabel: PropTypes.string.isRequired,
    noLabel: PropTypes.string.isRequired,
    value: PropTypes.bool,
    yesFirst: PropTypes.bool,
    onChange: PropTypes.func,
  };

  static defaultProps = {
    yesLabel: 'Yes',
    noLabel: 'No',
    yesFirst: true,
  };

  render() {
    const {disabled, yesFirst, yesLabel, noLabel, name, onChange, value} = this.props;
    const yesOption = (
      <Option
        value="true"
        checked={value === true}
        name={name}
        disabled={disabled}
        label={yesLabel}
        onChange={onChange}
      />
    );
    const noOption = (
      <Option
        value="false"
        checked={value === false}
        name={name}
        disabled={disabled}
        label={noLabel}
        onChange={onChange}
      />
    );

    return (
      <div>
        {yesFirst ? yesOption : noOption}
        {yesFirst ? noOption : yesOption}
      </div>
    );
  }
}
