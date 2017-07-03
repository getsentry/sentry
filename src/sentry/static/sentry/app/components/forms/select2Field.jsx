import jQuery from 'jquery';
import React from 'react';

import InputField from './inputField';

class Select2Field extends InputField {
  getField() {
    return (
      <select
        id={this.getId()}
        className="form-control"
        ref="input"
        placeholder={this.props.placeholder}
        onChange={this.onChange.bind(this)}
        disabled={this.props.disabled}
        required={this.props.required}
        multiple={this.props.multiple}
        value={this.state.value}>
        {(this.props.choices || []).map(choice => {
          return (
            <option key={choice[0]} value={choice[0]}>
              {choice[1]}
            </option>
          );
        })}
      </select>
    );
  }

  onChange = e => {
    if (this.props.multiple) {
      let options = e.target.options;
      let value = [];
      for (let i = 0; i < options.length; i++) {
        if (options[i].selected) {
          value.push(options[i].value);
        }
      }
      this.setValue(value);
    } else {
      this.setValue(e.target.value);
    }
  };

  getSelect2Options() {
    return {
      allowClear: this.props.allowClear,
      allowEmpty: this.props.allowEmpty,
      width: 'element',
      escapeMarkup: !this.props.escapeMarkup ? m => m : undefined
    };
  }

  componentDidMount() {
    jQuery(this.refs.input).select2(this.getSelect2Options()).on('change', this.onChange);
  }

  componentWillUnmount() {
    jQuery(this.refs.select).select2('destroy');
  }
}

Select2Field.propTypes = Object.assign(
  {
    choices: React.PropTypes.array.isRequired,
    allowClear: React.PropTypes.bool,
    allowEmpty: React.PropTypes.bool,
    multiple: React.PropTypes.bool,
    escapeMarkup: React.PropTypes.bool
  },
  InputField.propTypes
);

Select2Field.defaultProps = Object.assign({}, InputField.defaultProps, {
  allowEmpty: false,
  placeholder: '--',
  escapeMarkup: true,
  multiple: false
});

export default Select2Field;
