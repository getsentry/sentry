import React from 'react';
import jQuery from 'jquery';
import ReactDOM from 'react-dom';

import InputField from './inputField';

export default class RangeField extends InputField {
  static formatMinutes = value => {
    value = value / 60;
    return `${value} minute${value != 1 ? 's' : ''}`;
  };

  static propTypes = {
    ...InputField.propTypes,
    min: React.PropTypes.number,
    max: React.PropTypes.number,
    step: React.PropTypes.number,
    snap: React.PropTypes.bool,
    allowedValues: React.PropTypes.arrayOf(React.PropTypes.number)
  };

  static defaultProps = {
    ...InputField.defaultProps,
    formatLabel: value => value,
    min: 0,
    max: 100,
    step: 1,
    snap: true,
    allowedValues: null
  };

  componentDidMount() {
    super.componentDidMount();
    this.attachSlider();
  }

  componentWillUnmount() {
    this.removeSlider();
    super.componentWillUnmount();
  }

  attachSlider() {
    let $value = jQuery('<span class="value" />');
    let suffixClassNames = '';
    if (this.props.disabled) {
      suffixClassNames += ' disabled';
    }
    jQuery(ReactDOM.findDOMNode(this.refs.input))
      .on('slider:ready', (e, data) => {
        let value = parseInt(data.value, 10);
        $value.appendTo(data.el);
        $value.html(this.props.formatLabel(value));
      })
      .on('slider:changed', (e, data) => {
        let value = parseInt(data.value, 10);
        $value.html(this.props.formatLabel(value));
        this.setValue(value);
      })
      .simpleSlider({
        value: this.props.defaultValue || this.props.value,
        range: [this.props.min, this.props.max],
        step: this.props.step,
        snap: this.props.snap,
        allowedValues: this.props.allowedValues,
        classSuffix: suffixClassNames
      });
  }

  removeSlider() {
    // TODO(dcramer): it seems we cant actually implement this with the current slider
    // implementation
  }

  getAttributes() {
    return {
      min: this.props.min,
      max: this.props.max,
      step: this.props.step
    };
  }

  getType() {
    return 'range';
  }
}
