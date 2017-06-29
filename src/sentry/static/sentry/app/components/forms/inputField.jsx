import jQuery from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import FormField from './formField';

export default class InputField extends FormField {
  static propTypes = {
    ...FormField.propTypes,
    placeholder: React.PropTypes.string
  };

  // XXX(dcramer): this comes from TooltipMixin
  componentDidMount() {
    this.attachTooltips();
  }

  componentWillUnmount() {
    this.removeTooltips();
    jQuery(ReactDOM.findDOMNode(this)).unbind();
  }

  attachTooltips() {
    jQuery('.tip', ReactDOM.findDOMNode(this)).tooltip();
  }

  removeTooltips() {
    jQuery('.tip', ReactDOM.findDOMNode(this)).tooltip('destroy');
  }

  getAttributes() {
    return {};
  }

  getField() {
    return (
      <input
        id={this.getId()}
        type={this.getType()}
        className="form-control"
        placeholder={this.props.placeholder}
        onChange={this.onChange}
        disabled={this.props.disabled}
        ref="input"
        required={this.props.required}
        value={this.state.value}
        style={this.props.inputStyle}
        {...this.getAttributes()}
      />
    );
  }

  getClassName() {
    return 'control-group';
  }

  getType() {
    throw new Error('Must be implemented by child.');
  }
}
