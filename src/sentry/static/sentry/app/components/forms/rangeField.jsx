import jQuery from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';

import InputField from './inputField';

export default class RangeField extends InputField {
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
    jQuery(ReactDOM.findDOMNode(this.refs.input)).on('slider:ready', (e, data) => {
      $value.appendTo(data.el);
      $value.html(this.props.formatLabel(data.value));
    }).on('slider:changed', (e, data) => {
      $value.html(this.props.formatLabel(data.value));
      this.props.onChange(data.value);
    }).simpleSlider({
      range: [this.props.min, this.props.max],
      step: this.props.step,
      snap: this.props.snap,
      allowedValues: this.props.allowedValues,
    });
  }

  removeSlider() {
    // TODO(dcramer): it seems we cant actually implement this with the current slider
    // implementation
  }

  getField() {
    return (
      <input id={this.getId()}
          type={this.getType()}
          className="form-control"
          placeholder={this.props.placeholder}
          onChange={this.onChange.bind(this)}
          disabled={this.props.disabled}
          ref="input"
          min={this.props.min}
          max={this.props.max}
          step={this.props.step}
          value={this.state.value} />
    );
  }

  getType() {
    return 'range';
  }
}

RangeField.formatMinutes = (val) => {
  val = parseInt(val / 60, 10);
  return `${val} minute${(val != 1 ? 's' : '')}`;
};

RangeField.defaultProps = {
  onChange: (value) => {},
  formatLabel: (value) => value,
  min: 0,
  max: 100,
  step: 1,
  snap: true,
  allowedValues: null
};
