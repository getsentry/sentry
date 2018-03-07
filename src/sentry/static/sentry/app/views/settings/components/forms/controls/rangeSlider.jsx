import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../../../../locale';

class RangeSlider extends React.Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    /**
     * min allowed value, not needed if using `allowedValues`
     */
    min: PropTypes.number,
    /**
     * max allowed value, not needed if using `allowedValues`
     */
    max: PropTypes.number,
    value: PropTypes.number,
    step: PropTypes.number,
    onChange: PropTypes.func,

    /**
     * Render prop for slider's label
     * Is passed the value as an argument
     */
    formatLabel: PropTypes.func,

    /**
     * Array of allowed values. Make sure `value` is in this list.
     * THIS NEEDS TO BE SORTED
     */
    allowedValues: PropTypes.arrayOf(PropTypes.number),

    /**
     * This is called when *any* MouseUp or KeyUp event happens.
     * Used for "smart" Fields to trigger a "blur" event. `onChange` can
     * be triggered quite frequently
     */
    onBlur: PropTypes.func,
  };

  constructor(props) {
    super(props);

    let state = {sliderValue: props.value};
    if (props.allowedValues) {
      // With `allowedValues` sliderValue will be the index to value in `allowedValues`
      // This is so we can snap the rangeSlider using `step`
      // This means that the range slider will have a uniform `step` in the UI
      // and scale won't match `allowedValues
      // e.g. with allowedValues = [0, 100, 1000, 10000] - in UI we'll have values = [0, 3] w/ step of 1
      // so it always snaps at 25% width
      state.sliderValue = props.allowedValues.indexOf(props.value);
    }

    this.state = state;
  }

  componentWillReceiveProps(nextProps) {
    // Update local state when re-rendered with next `props.value` (e.g if this is controlled)
    if (typeof nextProps.value !== 'undefined') {
      let {allowedValues} = this.props;
      let sliderValue = nextProps.value;

      // If `allowedValues` is defined, then `sliderValue` represents index to `allowedValues`
      if (allowedValues && allowedValues.indexOf(sliderValue) > -1) {
        sliderValue = allowedValues.indexOf(sliderValue);
      }
      this.setState({sliderValue});
    }
  }

  getActualValue = sliderValue => {
    let {allowedValues} = this.props;
    let value;

    if (allowedValues) {
      // If `allowedValues` is defined, then `sliderValue` represents index to `allowedValues`
      value = allowedValues[sliderValue];
    } else {
      value = sliderValue;
    }

    return value;
  };

  handleInput = e => {
    let sliderValue = parseInt(e.target.value, 10);

    this.setState({
      sliderValue,
    });

    if (this.props.onChange) {
      let value = this.getActualValue(sliderValue);
      this.props.onChange(value, e);
    }
  };

  render() {
    let {name, min, max, step, allowedValues, formatLabel} = this.props;
    let {sliderValue} = this.state;
    let actualValue = sliderValue;
    let displayValue = actualValue;

    if (allowedValues) {
      step = 1;
      min = 0;
      max = allowedValues.length - 1;
      actualValue = allowedValues[sliderValue];
      displayValue =
        typeof actualValue !== 'undefined' ? actualValue : t('Invalid value');
    }

    displayValue =
      typeof formatLabel === 'function' ? formatLabel(actualValue) : displayValue;

    return (
      <div>
        <Label for={name}>{displayValue}</Label>
        <Slider
          type="range"
          name={name}
          min={min}
          max={max}
          step={step}
          onInput={this.handleInput}
          onChange={() => {}}
          onMouseUp={e => this.props.onBlur(e)}
          onKeyUp={e => this.props.onBlur(e)}
          value={sliderValue}
        />
      </div>
    );
  }
}

export default RangeSlider;

const Slider = styled.input`
  -webkit-appearance: none;
  width: 100%;
  margin: ${p => p.theme.grid}px 0 ${p => p.theme.grid * 2}px;

  &:focus {
    outline: none;

    &::-webkit-slider-runnable-track {
      background: ${p => p.theme.borderDark};
    }

    &::-ms-fill-upper {
      background: ${p => p.theme.borderDark};
    }

    &::-ms-fill-lower {
      background: ${p => p.theme.borderDark};
    }
  }

  &::-webkit-slider-runnable-track {
    width: 100%;
    height: 3px;
    cursor: pointer;
    background: ${p => p.theme.borderLight};
    border-radius: 3px;
    border: 0;
  }

  &::-moz-range-track {
    width: 100%;
    height: 3px;
    cursor: pointer;
    background: ${p => p.theme.borderLight};
    border-radius: 3px;
    border: 0;
  }

  &::-ms-track {
    width: 100%;
    height: 3px;
    cursor: pointer;
    background: ${p => p.theme.borderLight};
    border-radius: 3px;
    border: 0;
  }

  &::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px #fff;
    height: 17px;
    width: 17px;
    border-radius: 50%;
    background: ${p => p.theme.purple};
    cursor: pointer;
    -webkit-appearance: none;
    margin-top: -7px;
    border: 0;
  }

  &::-moz-range-thumb {
    box-shadow: 0 0 0 3px #fff;
    height: 17px;
    width: 17px;
    border-radius: 50%;
    background: ${p => p.theme.purple};
    cursor: pointer;
    -webkit-appearance: none;
    margin-top: -7px;
    border: 0;
  }

  &::-ms-thumb {
    box-shadow: 0 0 0 3px #fff;
    height: 17px;
    width: 17px;
    border-radius: 50%;
    background: ${p => p.theme.purple};
    cursor: pointer;
    -webkit-appearance: none;
    margin-top: -7px;
    border: 0;
  }

  &::-ms-fill-lower {
    background: ${p => p.theme.borderLight};
    border: 0;
    border-radius: 50%;
  }

  &::-ms-fill-upper {
    background: ${p => p.theme.borderLight});
    border: 0;
    border-radius: 50%;
  }
`;

const Label = styled.label`
  font-size: 14px;
  margin-bottom: ${p => p.theme.grid}px;
  color: ${p => p.theme.gray3};
`;
