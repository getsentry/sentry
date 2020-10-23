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
    choices: PropTypes.oneOfType([PropTypes.array, PropTypes.func]),
    allowClear: PropTypes.bool,
    allowEmpty: PropTypes.bool,
    multiple: PropTypes.bool,
    escapeMarkup: PropTypes.bool,
    small: PropTypes.bool,
    components: PropTypes.any,
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

    console.log('handleChange', optionObj, value);

    onChange(value, {});
    onBlur(value, {});
  };

  render() {
    const {multiple, allowClear, ...otherProps} = this.props;
    return (
      <InputField
        {...otherProps}
        alignRight={this.props.small}
        field={({onChange, onBlur, required: _required, ...props}) => (
          <SelectControl
            {...props}
            clearable={allowClear}
            multiple={multiple}
            onChange={this.handleChange.bind(this, onBlur, onChange)}
          />
        )}
      />
    );
  }
}
