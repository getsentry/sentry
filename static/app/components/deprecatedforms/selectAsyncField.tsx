import {
  SelectAsync,
  type SelectAsyncControlProps,
} from 'sentry/components/core/select/async';
import {
  SelectField,
  type SelectFieldProps,
} from 'sentry/components/deprecatedforms/selectField';
import withFormContext from 'sentry/components/deprecatedforms/withFormContext';

interface SelectAsyncFieldProps
  extends SelectFieldProps,
    Omit<SelectAsyncControlProps, 'value' | 'onQuery' | 'onResults'> {
  onQuery?: SelectAsyncControlProps['onQuery'];
  onResults?: SelectAsyncControlProps['onResults'];
}

/**
 * @deprecated Do not use this
 */
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
      <SelectAsync
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

/**
 * @deprecated Do not use this
 */
export default withFormContext(SelectAsyncField) as React.ComponentType<
  Omit<SelectAsyncFieldProps, 'formContext'>
>;
