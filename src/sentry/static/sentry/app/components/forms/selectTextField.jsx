import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {defined} from 'app/utils';
import FormField from 'app/components/forms/formField';
import SelectControl from 'app/components/forms/selectControl';
import convertFromSelect2Choices from 'app/utils/convertFromSelect2Choices';

export default class SelectTextField extends FormField {
  static propTypes = {
    ...FormField.propTypes,
    options: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.node,
        value: PropTypes.any,
      })
    ),
    choices: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.array])),
    onChange: PropTypes.func,
    clearable: PropTypes.bool,
    creatable: PropTypes.bool,
  };

  constructor(props) {
    super(props);

    // We only want to parse options once because react-select relies
    // on `options` mutation when you create a new option
    //
    // Otherwise you will not get the created option in the dropdown menu
    this.options = this.getOptions(props);
  }

  componentWillReceiveProps(nextProps, nextContext) {
    // super.componentWillReceiveProps(nextProps, nextContext);
    let newError = this.getError(nextProps, nextContext);
    if (newError != this.state.error) {
      this.setState({error: newError});
    }
    if (this.props.value !== nextProps.value || defined(nextContext.form)) {
      let newValue = this.getValue(nextProps, nextContext);
      // This is the only thing that is different from parent, we compare newValue against coerved value in state
      // To remain compatible with react-select, we need to store the option object that
      // includes `value` and `label`, but when we submit the format, we need to coerce it
      // to just return `value`. Also when field changes, it propagates the coerved value up
      if (newValue !== this.coerceValue(this.state.value)) {
        this.setValue(newValue);
      }
    }
  }

  getOptions(props) {
    return convertFromSelect2Choices(props.choices) || props.options;
  }

  // Not sure why, but we need this to get react-select's `Creatable` to work properly
  // Otherwise, when you hit "enter" to create a new item, the "selected value" does
  // not update with new value (and also new value is not displayed in dropdown)
  getClassName = () => '';

  coerceValue(value) {
    return value ? value.value : null;
  }

  onChange = opt => {
    this.setValue(opt);
  };

  getField() {
    let {placeholder, disabled, required, clearable} = this.props;

    return (
      <FieldSeparator>
        <SelectControl
          creatable
          id={this.getId()}
          options={this.options}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          value={this.state.value}
          onChange={this.onChange}
          clearable={clearable}
        />
      </FieldSeparator>
    );
  }
}

// This is because we are removing `control-group` class name which provides margin-bottom
const FieldSeparator = styled('div')`
  margin-bottom: 15px;
`;
