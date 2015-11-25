import React from 'react';
import jQuery from 'jquery';

const SelectInput = React.createClass({
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

  componentDidMount() {
    this.create();
  },

  componentWillUpdate() {
    this.destroy();
  },

  componentDidUpdate() {
    this.create();
  },

  componentWillUnmount() {
    this.destroy();
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

  render() {
    let opts = {
        ref: 'select',
        disabled: this.props.disabled,
        required: this.props.required,
        multiple: this.props.multiple,
        placeholder: this.props.placeholder,
        className: this.props.className,
        value: this.props.value,
    };
    return (
      <select {...opts}>
        {this.props.children}
      </select>
    );
  }
});

export default SelectInput;
