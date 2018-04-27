import PropTypes from 'prop-types';
import React from 'react';
import Select2Field from 'app/components/forms/select2Field';

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
        data: this.props.onQuery.bind(this),
        cache: true,
        results: this.props.onResults.bind(this),
        delay: this.props.ajaxDelay,
      },
      id: this.props.id,
      formatResult: this.props.formatResult
        ? this.props.formatResult.bind(this)
        : undefined,
      formatSelection: this.props.formatSelection
        ? this.props.formatSelection.bind(this)
        : undefined,
      formatAjaxError: error => {
        let resp = error.responseJSON;
        if (resp && resp.error_type === 'validation') {
          let message = resp.errors[0] && resp.errors[0].__all__;
          if (message) {
            return message;
          }
        }
        return 'Loading failed';
      },
    });
  }
}

Select2FieldAutocomplete.defaultProps = Object.assign(
  {
    onResults: function(data, page) {
      return {results: data[this.props.name]};
    },
    onQuery: function(query, page) {
      return {autocomplete_query: query, autocomplete_field: this.props.name};
    },
    minimumInputLength: null,
    ajaxDelay: 250,
  },
  Select2Field.defaultProps
);

Select2FieldAutocomplete.propTypes = Object.assign({}, Select2Field.propTypes, {
  ajaxDelay: PropTypes.number,
  minimumInputLength: PropTypes.number,
  formatResult: PropTypes.func,
  formatSelection: PropTypes.func,
  onResults: PropTypes.func,
  onQuery: PropTypes.func,
  url: PropTypes.string.isRequired,
  id: PropTypes.any,
});

delete Select2FieldAutocomplete.propTypes.choices;

export default Select2FieldAutocomplete;
