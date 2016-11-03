import jQuery from 'jquery';
import React from 'react';

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
          multiple={this.props.multiple || false}
          value={this.state.value}>
        {(this.props.choices || []).map((choice) => {
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

  onChange(e) {
    if (this.props.multiple) {
      let options = e.target.options;
      let value = [];
      for (let i = 0; i < options.length; i++) {
        if (options[i].selected) {
          value.push(options[i].value);
        }
      }
      this.setState({
        value: value,
      }, () => {
        this.props.onChange(this.state.value);
      });
      return;
    }
    super.onChange(e);
  }

  componentDidMount() {
    jQuery(this.refs.input).select2().on('change', this.onChange);
  }

  componentWillUnmount() {
    jQuery(this.refs.select).select2('destroy');
  }
}

Select2Field.propTypes = Object.assign({
  choices: React.PropTypes.array.isRequired,
}, InputField.propTypes);

export default Select2Field;
