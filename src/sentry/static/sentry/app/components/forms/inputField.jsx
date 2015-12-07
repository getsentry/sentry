import React from 'react';
import FormField from './formField';

export default class InputField extends FormField {
  constructor(props) {
    super(props);
    this.state.value = props.defaultValue || '';
  }

  onChange(e) {
    this.setState({
      value: e.target.value,
    }, () => {
      this.props.onChange(this.state.value);
    });
  }

  render() {
    return (
      <div className="control-group">
        <div className="controls">
          <label>{this.props.label}</label>
          <input type={this.getType()}
                 className="form-control"
                 placeholder={this.props.placeholder}
                 onChange={this.onChange.bind(this)}
                 disabled={this.props.disabled}
                 value={this.state.value} />
          {this.props.help &&
            <p className="help-block">{this.props.help}</p>
          }
        </div>
      </div>
    );
  }
}
