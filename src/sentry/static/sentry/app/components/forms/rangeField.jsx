import $ from 'jquery';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';

import InputField from 'app/components/forms/inputField';

export default class RangeField extends InputField {
  static formatMinutes = value => {
    value = value / 60;
    return `${value} minute${value !== 1 ? 's' : ''}`;
  };

  static propTypes = {
    ...InputField.propTypes,
    min: PropTypes.number,
    max: PropTypes.number,
    step: PropTypes.number,
    snap: PropTypes.bool,
    allowedValues: PropTypes.arrayOf(PropTypes.number),
  };

  static defaultProps = {
    ...InputField.defaultProps,
    formatLabel: value => value,
    min: 0,
    max: 100,
    step: 1,
    snap: true,
    allowedValues: null,
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
    const $value = $('<span class="value" />');
    let suffixClassNames = '';
    if (this.props.disabled) {
      suffixClassNames += ' disabled';
    }

    // eslint-disable-next-line react/no-find-dom-node
    $(ReactDOM.findDOMNode(this.refs.input))
      .on('slider:ready', (_e, data) => {
        const value = parseInt(data.value, 10);
        $value.appendTo(data.el);
        $value.html(this.props.formatLabel(value));
      })
      .on('slider:changed', (_e, data) => {
        const value = parseInt(data.value, 10);
        $value.html(this.props.formatLabel(value));
        this.setValue(value);
      })
      .simpleSlider({
        value: this.props.defaultValue || this.props.value,
        range: [this.props.min, this.props.max],
        step: this.props.step,
        snap: this.props.snap,
        allowedValues: this.props.allowedValues,
        classSuffix: suffixClassNames,
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
      step: this.props.step,
    };
  }

  getType() {
    return 'range';
  }
}
