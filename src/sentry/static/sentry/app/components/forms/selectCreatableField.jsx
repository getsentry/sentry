import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {StyledForm} from 'app/components/forms/form';
import {defined} from 'app/utils';
import SelectControl from 'app/components/forms/selectControl';
import SelectField from 'app/components/forms/selectField';
import convertFromSelect2Choices from 'app/utils/convertFromSelect2Choices';

/**
 * This is a <SelectField> that allows the user to create new options if one does't exist.
 *
 * This is used in some integrations
 */
export default class SelectCreatableField extends SelectField {
  static propTypes = {
    ...SelectField.propTypes,
    options: SelectControl.propTypes.options,
    clearable: SelectControl.propTypes.clearable,
    choices: SelectControl.propTypes.choices,
    onChange: PropTypes.func,
    creatable: PropTypes.bool,
    deprecatedSelectControl: PropTypes.bool,
  };

  constructor(props) {
    super(props);

    // We only want to parse options once because react-select relies
    // on `options` mutation when you create a new option
    //
    // Otherwise you will not get the created option in the dropdown menu
    this.options = this.getOptions(props);
  }

  UNSAFE_componentWillReceiveProps(nextProps, nextContext) {
    const newError = this.getError(nextProps, nextContext);
    if (newError !== this.state.error) {
      this.setState({error: newError});
    }
    if (this.props.value !== nextProps.value || defined(nextContext.form)) {
      const newValue = this.getValue(nextProps, nextContext);
      // This is the only thing that is different from parent, we compare newValue against coerved value in state
      // To remain compatible with react-select, we need to store the option object that
      // includes `value` and `label`, but when we submit the format, we need to coerce it
      // to just return `value`. Also when field changes, it propagates the coerced value up
      const coercedValue = this.coerceValue(this.state.value);

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

  getField() {
    const {
      deprecatedSelectControl,
      placeholder,
      disabled,
      required,
      clearable,
      name,
    } = this.props;

    return (
      <StyledSelectControl
        deprecatedSelectControl={deprecatedSelectControl}
        creatable
        id={this.getId()}
        options={this.options}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        value={this.state.value}
        onChange={this.onChange}
        clearable={clearable}
        multiple={this.isMultiple()}
        name={name}
      />
    );
  }
}

// This is because we are removing `control-group` class name which provides margin-bottom
const StyledSelectControl = styled(SelectControl)`
  ${StyledForm} &, .form-stacked & {
    .control-group & {
      margin-bottom: 0;
    }

    margin-bottom: 15px;
  }
`;
