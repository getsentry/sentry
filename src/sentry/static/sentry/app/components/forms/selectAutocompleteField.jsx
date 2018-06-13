import PropTypes from 'prop-types';
import React from 'react';

import SelectAutocompleteControl from './selectAutocompleteControl';
import SelectField from './selectField';

class SelectAutocompleteField extends SelectField {
  static propTypes = {
    ...SelectField.propTypes,
    ...SelectAutocompleteControl.propTypes,
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
    let {onChange} = this.props;
    const value = opt ? opt.value : null;
    this.setValue(value);

    if (typeof onChange === 'function') {
      onChange(value);
    }
  };

  getField() {
    return (
      <SelectAutocompleteControl
        value={this.state.value}
        onClear={this.handleClear}
        onResults={this.onResults}
        onQuery={this.onQuery}
        {...this.props}
        id={this.getId()}
        onChange={this.onChange}
      />
    );
  }
}

export default SelectAutocompleteField;
