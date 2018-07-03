import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {defined} from 'app/utils';
import FormField from 'app/components/forms/formField';
import SelectControl from 'app/components/forms/selectControl';
import convertFromSelect2Choices from 'app/utils/convertFromSelect2Choices';

/**
 * This is a <SelectField> that allows the user to create new options if one does't exist.
 *
 * This is used in some integrations
 */
export default class SelectCreatableField extends FormField {
  static propTypes = {
    ...FormField.propTypes,
    options: SelectControl.propTypes.options,
    clearable: SelectControl.propTypes.clearable,
    choices: SelectControl.propTypes.choices,
    onChange: PropTypes.func,
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
      // to just return `value`. Also when field changes, it propagates the coerced value up
      let coercedValue = this.coerceValue(this.state.value);

      // newValue can be empty string because of `getValue`, while coerceValue needs to return null (to differentiate
      // empty string from cleared item). We could use `!=` to compare, but lets be a bit more explicit with strict equality
      //
      // This can happen when this is apart of a field, and it re-renders onChange for a different field,
      // there will be a mismatch between this component's state.value and `this.getValue` result above
      if (
        newValue !== coercedValue &&
        !!newValue !== !!coercedValue &&
        newValue !== this.state.value
      ) {
        this.setValue(newValue);
      }
    }
  }

  getOptions(props) {
    return convertFromSelect2Choices(props.choices) || props.options;
  }

  getClassName = () => '';

  // Not sure why, but we need this to get react-select's `Creatable` to work properly
  // Otherwise, when you hit "enter" to create a new item, the "selected value" does
  // not update with new value (and also new value is not displayed in dropdown)
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
