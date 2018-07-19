import PropTypes from 'prop-types';
import React from 'react';

import {defined} from 'app/utils';

import SelectAsyncControl from './selectAsyncControl';
import SelectField from './selectField';

class SelectAsyncField extends SelectField {
  static propTypes = {
    ...SelectField.propTypes,
    ...SelectAsyncControl.propTypes,
    /**
     * API endpoint URL
     */
    url: PropTypes.string.isRequired,

    /**
     * Parses the results of API call for the select component
     */
    onResults: PropTypes.func,

    /**
     * Additional query parameters when sending API request
     */
    onQuery: PropTypes.func,

    /**
     * Field ID
     */
    id: PropTypes.any,
  };

  static defaultProps = {
    ...SelectField.defaultProps,
    placeholder: 'Start typing to search for an issue',
  };

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
      if (newValue !== coercedValue && !!newValue !== !!coercedValue) {
        this.setValue(newValue);
      }
    }
  }

  // Not sure why, but we need this to get react-select's `Creatable` to work properly
  // Otherwise, when you hit "enter" to create a new item, the "selected value" does
  // not update with new value (and also new value is not displayed in dropdown)
  coerceValue(value) {
    if (!value) return '';

    if (this.isMultiple()) {
      return value.map(v => v.value);
    } else if (value.hasOwnProperty('value')) {
      return value.value;
    }

    return value;
  }

  onResults = data => {
    let {name} = this.props;
    let results = data && data[name];

    return (results && results.map(({id, text}) => ({value: id, label: text}))) || [];
  };

  onQuery = query => {
    // Used by legacy integrations
    return {autocomplete_query: query, autocomplete_field: this.props.name};
  };

  onChange = opt => {
    // Changing this will most likely break react-select (e.g. you won't be able to select
    // a menu option that is from an async request).
    this.setValue(opt);
  };

  getField() {
    // Callers should be able to override all props except onChange
    // FormField calls props.onChange via `setValue`
    return (
      <SelectAsyncControl
        id={this.getId()}
        onResults={this.onResults}
        onQuery={this.onQuery}
        {...this.props}
        value={this.state.value}
        onChange={this.onChange}
      />
    );
  }
}

export default SelectAsyncField;
