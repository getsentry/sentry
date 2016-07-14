import ReactDOM from 'react-dom';
import InputField from './inputField';

export default class Select2Field extends InputField {
  getType() {
    return 'text';
  }

  componentDidMount() {
    let $el = $('input', ReactDOM.findDOMNode(this));
    $el.on('change.autocomplete', this.onChange.bind(this));
    let url = this.props.url + '?autocomplete_field=' + this.props.name;

    // TODO(jess): upgrade select2 so we can just do
    // dropdownParent: $('.modal-dialog') as a supported option
    $('.modal').removeAttr('tabindex');
    $el.select2({
      placeholder: 'Start typing to search for an issue',
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
      }
    });
  }

  componentWillUnmount() {
    let $el = $('input', ReactDOM.findDOMNode(this));
    $el.off('change.autocomplete');
  }
}
