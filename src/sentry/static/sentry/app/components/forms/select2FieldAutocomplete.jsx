import ReactDOM from 'react-dom';
import InputField from './inputField';

export default class Select2FieldAutocomplete extends InputField {
  getType() {
    return 'text';
  }

  componentDidMount() {
    let $el = $('input', ReactDOM.findDOMNode(this));
    $el.on('change.autocomplete', this.onChange.bind(this));
    let separator = this.props.url.includes('?') ? '&' : '?';
    let url = this.props.url + separator + 'autocomplete_field=' + this.props.name;

    $el.select2({
      placeholder: this.props.placeholder || 'Start typing to search for an issue',
      minimumInputLength: 1,
      ajax: {
        quietMillis: 100,
        url: url,
        dataType: 'json',
        data: (q) => {
          return {autocomplete_query: q};
        },
        results: (data) => {
          return {results: data[this.props.name]};
        }
      },
      formatAjaxError: (error) => {
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

  componentWillUnmount() {
    let $el = $('input', ReactDOM.findDOMNode(this));
    $el.off('change.autocomplete');
  }
}
