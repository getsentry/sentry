
import ReactDOM from 'react-dom';
import InputField from './inputField';

export default class Select2Field extends InputField {
  getType() {
    return 'text';
  }

  componentDidMount() {
    let $el = $('input', ReactDOM.findDOMNode(this));
    $el.on('change.autocomplete', this.onChange.bind(this));
    // TODO: make configurable
    let url = '/api/0/issues/101/plugin/autocomplete/github?autocomplete_field=' + this.props.name;
    $el.select2({
      placeholder: 'Start typing to search for an issue',
      minimumInputLength: 1,
      ajax: {
        quietMillis: 100,
        url: url,
        dataType: 'json',
        data: function(q) {
          return {autocomplete_query: q};
        },
        results: function(data) {
          // TODO: this needs to be configurable
          return {results: data.issues};
        }
      }
    });
  }

  componentWillUnmount() {
    let $el = $('input', ReactDOM.findDOMNode(this));
    $el.off('change.autocomplete');
  }
}
