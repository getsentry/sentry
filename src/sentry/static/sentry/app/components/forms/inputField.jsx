import jQuery from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import FormField from './formField';

import {defined} from '../../utils';

class InputField extends FormField {
  constructor(props) {
    super(props);

    this.onChange = this.onChange.bind(this);

    this.state.value = this.valueFromProps(props);
  }

  valueFromProps(props) {
    return defined(props.value) ? props.value : (props.defaultValue || '');
  }

  // XXX(dcramer): this comes from TooltipMixin
  componentDidMount() {
    this.attachTooltips();
  }

  componentWillUnmount() {
    this.removeTooltips();
    jQuery(ReactDOM.findDOMNode(this)).unbind();
  }

  attachTooltips() {
    jQuery('.tip', ReactDOM.findDOMNode(this))
      .tooltip();
  }

  removeTooltips() {
    jQuery('.tip', ReactDOM.findDOMNode(this))
      .tooltip('destroy');
  }

  onChange(e) {
    this.setState({
      value: e.target.value,
    }, () => {
      this.props.onChange(this.state.value);
    });
  }

  getId() {
    return 'id-' + this.props.name;
  }

  getField() {
    return (
      <input id={this.getId()}
          type={this.getType()}
          className="form-control"
          placeholder={this.props.placeholder}
          onChange={this.onChange}
          disabled={this.props.disabled}
          ref="input"
          required={this.props.required}
          value={this.state.value} />
    );
  }

  getClassName() {
    return 'control-group';
  }

  render() {
    let className = this.getClassName();
    if (this.props.error) {
      className += ' has-error';
    }
    return (
      <div className={className}>
        <div className="controls">
          <label htmlFor={this.getId()} className="control-label">{this.props.label}</label>
          {this.props.disabled && this.props.disabledReason &&
            <span className="disabled-indicator tip" title={this.props.disabledReason}>
              <span className="icon-question" />
            </span>
          }
          {this.getField()}
          {defined(this.props.help) &&
            <p className="help-block">{this.props.help}</p>
          }
          {this.props.error &&
            <p className="error">{this.props.error}</p>
          }
        </div>
      </div>
    );
  }
}

InputField.propTypes = Object.assign({
  placeholder: React.PropTypes.string,
}, FormField.propTypes);

export default InputField;
