import SelectField from 'sentry/components/deprecatedforms/selectField';
import SelectAsyncControl from 'sentry/components/forms/controls/selectAsyncControl';

class SelectAsyncField extends SelectField {
  static defaultProps = {
    ...SelectField.defaultProps,
    placeholder: 'Start typing to search for an issue',
  };

  onResults = (data: any) => {
    const {name} = this.props;
    const results = data?.[name];

    return results?.map(({id, text}: any) => ({value: id, label: text})) || [];
  };

  onQuery = (
    // Used by legacy integrations
    query: any
  ) => ({
    autocomplete_query: query,
    autocomplete_field: this.props.name,
  });

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
