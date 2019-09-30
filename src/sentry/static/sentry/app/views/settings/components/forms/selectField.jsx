import PropTypes from 'prop-types';
import React from 'react';

import InputField from 'app/views/settings/components/forms/inputField';
import SelectControl from 'app/components/forms/selectControl';

const getChoices = props => {
  let choices = props.choices || [];

  if (typeof props.choices === 'function') {
    choices = props.choices(props);
  }

  return choices;
};

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
    formatMessageValue: (value, props) =>
      (getChoices(props).find(choice => choice[0] === value) || [null, value])[1],
  };

  handleChange = (onBlur, onChange, optionObj) => {
    let value;

    // If optionObj is empty, then it probably means that the field was "cleared"
    if (!optionObj) {
      value = optionObj;
    } else if (this.props.multiple) {
      // List of optionObjs
      value = optionObj.map(({value: val}) => val);
    } else {
      value = optionObj.value;
    }

    onChange(value, {});
    onBlur(value, {});
  };

  render() {
    const {multiple, allowClear, ...otherProps} = this.props;
    return (
      <InputField
        {...otherProps}
        alignRight={this.props.small}
        field={({onChange, onBlur, disabled, required: _required, ...props}) => {
          // We remove the required property here since applying it to the
          // DOM causes the native tooltip to render in strange places.
          const choices = getChoices(props);

          return (
            <SelectControl
              {...props}
              clearable={allowClear}
              multiple={multiple}
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
