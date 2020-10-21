import PropTypes from 'prop-types';

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

    deprecatedSelectControl: PropTypes.bool,
  };

  static defaultProps = {
    ...SelectField.defaultProps,
    placeholder: 'Start typing to search for an issue',
  };

  onResults = data => {
    const {name} = this.props;
    const results = data && data[name];

    return (results && results.map(({id, text}) => ({value: id, label: text}))) || [];
  };

  onQuery = query =>
    // Used by legacy integrations
    ({autocomplete_query: query, autocomplete_field: this.props.name});

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
