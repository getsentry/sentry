import React from "react";
import jQuery from "jquery";

var SelectInput = React.createClass({
  getDefaultProps() {
    return {
      // HTML attrs
      disabled: false,
      multiple: false,
      required: false,

      // Extra options
      placeholder: 'Select an option...',

      // Component options
      value: '',
      onChange: $.noop
    };
  },

  getValue() {
    return this.select2.getValue();
  },

  create() {
    this.select2 = jQuery(this.refs.select).select2();
    this.select2.on('change', this.onChange);
  },

  destroy() {
    jQuery(this.refs.select).select2('destroy');
  },

  onChange(...args) {
    this.props.onChange.call(this, this.select2, ...args);
  },

  componentDidMount() {
    this.create();
  },

  componentWillUnmount() {
    this.destroy();
  },

  componentWillUpdate() {
    this.destroy();
  },

  componentDidUpdate() {
    this.create();
  },

  render() {
    var opts = {
        ref: 'select',
        disabled: this.props.disabled,
        required: this.props.required,
        multiple: this.props.multiple,
        placeholder: this.props.placeholder,
        className: this.props.className
    };
    return (
      <select {...opts}>
        {this.props.children}
      </select>
    );
  }
});

export default SelectInput;
