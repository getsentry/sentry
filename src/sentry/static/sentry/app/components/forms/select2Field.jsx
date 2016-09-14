import jQuery from 'jquery';
import React from 'react';

import InputField from './inputField';

export default class Select2Field extends InputField {
  getField() {
    return (
      <select id={this.getId()}
          className="form-control"
          onChange={this.onChange.bind(this)}
          disabled={this.props.disabled}
          value={this.state.value}>
        <option key="" value="">&nbsp;</option>
        {this.props.choices.map((choice) => {
          return (
            <option key={choice[0]}
                    value={choice[0]}>
              {choice[1]}
            </option>
          );
        })}
      </select>
    );
  }

  componentDidMount() {
    this.select2 = jQuery(this.refs.input).select2({
    });
    this.select2.on('change', this.onChange);

    // TODO(jess): upgrade select2 so we can just do
    // dropdownParent: $('.modal-dialog') as a supported option
    jQuery('.modal').removeAttr('tabindex');
  }

  componentWillUnmount() {
    jQuery(this.refs.select).select2('destroy');
  }

}
