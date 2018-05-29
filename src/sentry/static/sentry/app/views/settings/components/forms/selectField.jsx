import PropTypes from 'prop-types';
import React from 'react';

import InputField from 'app/views/settings/components/forms/inputField';
import SelectControl from 'app/components/forms/selectControl';

export default class SelectField extends React.Component {
  static propTypes = {
    ...InputField.propTypes,
    choices: PropTypes.oneOfType([PropTypes.array, PropTypes.func]).isRequired,
    allowClear: PropTypes.bool,
    allowEmpty: PropTypes.bool,
    multiple: PropTypes.bool,
    escapeMarkup: PropTypes.bool,
    small: PropTypes.bool,
  };

  static defaultProps = {
    ...InputField.defaultProps,
    allowClear: false,
    allowEmpty: false,
    placeholder: '--',
    escapeMarkup: true,
    multiple: false,
    small: false,
  };

  handleChange = (onBlur, onChange, optionObj) => {
    let value;

    if (this.props.multiple) {
      // List of optionObjs
      value = optionObj.map(({value: val}) => val);
    } else {
      value = optionObj.value;
    }

    onChange(value, {});
    onBlur(value, {});
  };

  render() {
    let {multiple, allowClear, ...otherProps} = this.props;
    return (
      <InputField
        {...otherProps}
        alignRight={this.props.small}
        field={({onChange, onBlur, disabled, ...props}) => {
          let choices = props.choices || [];

          if (typeof props.choices === 'function') {
            choices = props.choices(props);
          }

          return (
            <SelectControl
              {...props}
              clearable={allowClear}
              multi={multiple}
              disabled={disabled}
              onChange={this.handleChange.bind(this, onBlur, onChange)}
              value={props.value}
              options={choices.map(([value, label]) => ({
                value,
                label,
              }))}
            />
          );
        }}
      />
    );
  }
}
