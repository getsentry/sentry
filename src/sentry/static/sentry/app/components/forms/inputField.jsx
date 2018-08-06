import jQuery from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import FormField from 'app/components/forms/formField';

export default class InputField extends FormField {
  static propTypes = {
    ...FormField.propTypes,
    placeholder: PropTypes.string,
  };

  // XXX(dcramer): this comes from TooltipMixin
  componentDidMount() {
    super.componentDidMount();
    this.attachTooltips();
  }

  componentWillUnmount() {
    this.removeTooltips();
    jQuery(ReactDOM.findDOMNode(this)).unbind();
    super.componentWillUnmount();
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
        name={this.props.name}
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
