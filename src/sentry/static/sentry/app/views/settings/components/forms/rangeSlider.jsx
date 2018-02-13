import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

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

class RangeSlider extends React.Component {
  static propTypes = {
    initialValue: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    min: PropTypes.number.isRequired,
    max: PropTypes.number.isRequired,
    step: PropTypes.number.isRequired,
    label: PropTypes.string,
    plural: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {value: props.initialValue};
    this.handleValue = this.handleValue.bind(this);
  }

  handleValue = e => {
    this.setState({
      value: e.currentTarget.value,
    });
  };

  render() {
    let {name, label, plural, min, max, step} = this.props;
    let {value} = this.state;

    let renderedLabel;
    value == 1 ? (renderedLabel = label) : (renderedLabel = plural);

    return (
      <div>
        <Label for={name}>
          {value} {renderedLabel}
        </Label>
        <Slider
          type="range"
          name={name}
          min={min}
          max={max}
          step={step}
          onInput={this.handleValue}
          value={value}
        />
      </div>
    );
  }
}

export default RangeSlider;
