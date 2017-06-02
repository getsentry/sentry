import React from 'react';
import Select2Field from './select2Field';

class Select2FieldAutocomplete extends Select2Field {
  getField() {
    return (
      <input
        id={this.getId()}
        className="form-control"
        ref="input"
        type="text"
        placeholder={this.props.placeholder}
        onChange={this.onChange.bind(this)}
        disabled={this.props.disabled}
        required={this.props.required}
        value={this.state.value}
      />
    );
  }

  getSelect2Options() {
    return Object.assign(super.getSelect2Options(), {
      placeholder: this.props.placeholder || 'Start typing to search for an issue',
      minimumInputLength: this.props.minimumInputLength,
      ajax: {
        url: this.props.url,
        dataType: 'json',
        data: this.props.onQuery,
        cache: true,
        results: this.props.onResults,
        delay: this.props.ajaxDelay
      },
      id: this.props.id,
      formatResult: this.props.formatResult,
      formatSelection: this.props.formatSelection,
      formatAjaxError: error => {
        let resp = error.responseJSON;
        if (resp && resp.error_type === 'validation') {
          let message = resp.errors[0] && resp.errors[0].__all__;
          if (message) {
            return message;
          }
        }
        return 'Loading failed';
      }
    });
  }
}

Select2FieldAutocomplete.defaultProps = Object.assign(
  {
    onResults: (data, page) => {
      return data[this.props.name];
    },
    onQuery: (query, page) => {
      return {autocomplete_query: query, autocomplete_field: this.props.name};
    },
    minimumInputLength: 0,
    ajaxDelay: 250
  },
  Select2Field.defaultProps
);

Select2FieldAutocomplete.propTypes = Object.assign({}, Select2Field.propTypes, {
  ajaxDelay: React.PropTypes.number,
  minimumInputLength: React.PropTypes.number,
  formatResult: React.PropTypes.func,
  formatSelection: React.PropTypes.func,
  onResults: React.PropTypes.func,
  onQuery: React.PropTypes.func,
  url: React.PropTypes.string.isRequired,
  id: React.PropTypes.any
});

delete Select2FieldAutocomplete.propTypes.choices;

export default Select2FieldAutocomplete;
