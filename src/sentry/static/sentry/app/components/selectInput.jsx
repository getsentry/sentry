import React from 'react';
import jQuery from 'jquery';

const SelectInput = React.createClass({
  propTypes: {
    disabled: React.PropTypes.bool,
    multiple: React.PropTypes.bool,
    required: React.PropTypes.bool,
    placeholder: React.PropTypes.string,
    value: React.PropTypes.string,
    onChange: React.PropTypes.func,
  },

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
    /*below is a hack for a bug in edge related to form submitting.
    see: https://github.com/facebook/react/issues/7655
    (@maxbittker)*/
    if (this.refs.select) {
      let selectedIndex = this.refs.select.selectedIndex;
      if (selectedIndex >= 0) {
       let options = this.refs.select.options;
       let tempIndex = (selectedIndex + 1) % options.length;

       options[tempIndex].selected = true;
       options[selectedIndex].selected = true;
      }
    }
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
    this.select2 = jQuery(this.refs.select).select2({
      width: 'element'
    });
    this.select2.on('change', this.onChange);
  },

  destroy() {
    jQuery(this.refs.select).select2('destroy');
  },

  onChange(...args) {
    this.props.onChange.call(this, this.select2, ...args);
  },

  render() {
    return (
      <select ref="select" {...this.props}>
        {this.props.children}
      </select>
    );
  }
});

export default SelectInput;
