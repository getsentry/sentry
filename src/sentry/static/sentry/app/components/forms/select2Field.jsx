import React from 'react';
import ReactDOM from 'react-dom';

import InputField from './inputField';

class Select2Field extends InputField {
  getField() {
    return (
      <select id={this.getId()}
          className="form-control"
          ref="input"
          placeholder={this.props.placeholder}
          onChange={this.onChange.bind(this)}
          disabled={this.props.disabled}
          required={this.props.required}
          value={this.state.value}>
          {this.props.choices.map((choice) => {
            return (
              <option key={choice[0]}
                      value={choice[0]}>{choice[1]}</option>
            );
          })}
      </select>
    );
  }

  componentDidMount() {
    let $el = $('select', ReactDOM.findDOMNode(this));
    $el.on('change.select2field', this.onChange.bind(this));

    // TODO(jess): upgrade select2 so we can just do
    // dropdownParent: $('.modal-dialog') as a supported option
    $('.modal').removeAttr('tabindex');
    $el.select2();
  }

  componentWillUnmount() {
    let $el = $('select', ReactDOM.findDOMNode(this));
    $el.off('change.select2field');
  }
}

Select2Field.propTypes = Object.assign({
  choices: React.PropTypes.array.isRequired,
}, InputField.propTypes);

export default Select2Field;
