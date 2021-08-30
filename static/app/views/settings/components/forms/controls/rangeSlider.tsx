import React, {ChangeEvent, KeyboardEvent, MouseEvent, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import Input from 'app/views/settings/components/forms/controls/input';

type Props = {
  name: string;

  /**
   * String is a valid type here only for empty string
   * Otherwise react complains:
   * "`value` prop on `input` should not be null. Consider using an empty string to clear the component or `undefined` for uncontrolled components."
   *
   * And we want this to be a controlled input when value is empty
   */
  value: number | '';

  /**
   * min allowed value, not needed if using `allowedValues`
   */
  min?: number;

  /**
   * max allowed value, not needed if using `allowedValues`
   */
  max?: number;

  step?: number;
  disabled?: boolean;

  /**
   * Render prop for slider's label
   * Is passed the value as an argument
   */
  formatLabel?: (value: number | '') => React.ReactNode;

  /**
   * Array of allowed values. Make sure `value` is in this list.
   * THIS NEEDS TO BE SORTED
   */
  allowedValues?: number[];

  /**
   * Show input control for custom values
   */
  showCustomInput?: boolean;
  /**
   * Show label with current value
   */
  showLabel?: boolean;

  /**
   * Placeholder for custom input
   */
  placeholder?: string;

  /**
   * This is called when *any* MouseUp or KeyUp event happens.
   * Used for "smart" Fields to trigger a "blur" event. `onChange` can
   * be triggered quite frequently
   */
  onBlur?: (
    event: MouseEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>
  ) => void;
  onChange?: (value: Props['value'], event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  forwardRef?: React.Ref<HTMLDivElement>;
};

function RangeSlider({
  value,
  allowedValues,
  showCustomInput,
  name,
  disabled,
  placeholder,
  formatLabel,
  className,
  onBlur,
  onChange,
  forwardRef,
  showLabel = true,
  ...props
}: Props) {
  const [sliderValue, setSliderValue] = useState(
    allowedValues ? allowedValues.indexOf(Number(value || 0)) : value
  );

  useEffect(() => {
    updateSliderValue();
  }, [value]);

  function updateSliderValue() {
    if (!defined(value)) {
      return;
    }

    const newSliderValueIndex = allowedValues?.indexOf(Number(value || 0)) ?? -1;

    // If `allowedValues` is defined, then `sliderValue` represents index to `allowedValues`
    if (newSliderValueIndex > -1) {
      setSliderValue(newSliderValueIndex);
      return;
    }

    setSliderValue(value);
  }

  function getActualValue(newSliderValue: Props['value']): Props['value'] {
    if (!allowedValues) {
      return newSliderValue;
    }

    // If `allowedValues` is defined, then `sliderValue` represents index to `allowedValues`
    return allowedValues[newSliderValue];
  }

  function handleInput(e: ChangeEvent<HTMLInputElement>) {
    const newSliderValue = parseInt(e.target.value, 10);
    setSliderValue(newSliderValue);
    onChange?.(getActualValue(newSliderValue), e);
  }

  function handleCustomInputChange(e: ChangeEvent<HTMLInputElement>) {
    setSliderValue(parseInt(e.target.value, 10) || 0);
  }

  function handleBlur(e: MouseEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>) {
    if (typeof onBlur !== 'function') {
      return;
    }

    onBlur(e);
  }

  function getSliderData() {
    if (!allowedValues) {
      const {min, max, step} = props;
      return {
        min,
        max,
        step,
        actualValue: sliderValue,
        displayValue: sliderValue,
      };
    }

    const actualValue = allowedValues[sliderValue];

    return {
      step: 1,
      min: 0,
      max: allowedValues.length - 1,
      actualValue,
      displayValue: defined(actualValue) ? actualValue : t('Invalid value'),
    };
  }

  const {min, max, step, actualValue, displayValue} = getSliderData();

  return (
    <div className={className} ref={forwardRef}>
      {!showCustomInput && showLabel && (
        <Label htmlFor={name}>{formatLabel?.(actualValue) ?? displayValue}</Label>
      )}
      <SliderAndInputWrapper showCustomInput={showCustomInput}>
        <Slider
          type="range"
          name={name}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onInput={handleInput}
          onMouseUp={handleBlur}
          onKeyUp={handleBlur}
          value={sliderValue}
          hasLabel={!showCustomInput}
        />
        {showCustomInput && (
          <Input
            placeholder={placeholder}
            value={sliderValue}
            onChange={handleCustomInputChange}
            onBlur={handleInput}
          />
        )}
      </SliderAndInputWrapper>
    </div>
  );
}

const RangeSliderContainer = React.forwardRef(function RangeSliderContainer(
  props: Props,
  ref: React.Ref<any>
) {
  return <RangeSlider {...props} forwardRef={ref} />;
});

export default RangeSliderContainer;

export const Slider = styled('input')<{hasLabel: boolean}>`
  /* stylelint-disable-next-line property-no-vendor-prefix */
  -webkit-appearance: none;
  width: 100%;
  background: transparent;
  margin: ${p => p.theme.grid}px 0 ${p => p.theme.grid * (p.hasLabel ? 2 : 1)}px;

  &::-webkit-slider-runnable-track {
    width: 100%;
    height: 3px;
    cursor: pointer;
    background: ${p => p.theme.border};
    border-radius: 3px;
    border: 0;
  }

  &::-moz-range-track {
    width: 100%;
    height: 3px;
    cursor: pointer;
    background: ${p => p.theme.border};
    border-radius: 3px;
    border: 0;
  }

  &::-ms-track {
    width: 100%;
    height: 3px;
    cursor: pointer;
    background: ${p => p.theme.border};
    border-radius: 3px;
    border: 0;
  }

  &::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px ${p => p.theme.background};
    height: 17px;
    width: 17px;
    border-radius: 50%;
    background: ${p => p.theme.active};
    cursor: pointer;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    margin-top: -7px;
    border: 0;
  }

  &::-moz-range-thumb {
    box-shadow: 0 0 0 3px ${p => p.theme.background};
    height: 17px;
    width: 17px;
    border-radius: 50%;
    background: ${p => p.theme.active};
    cursor: pointer;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    margin-top: -7px;
    border: 0;
  }

  &::-ms-thumb {
    box-shadow: 0 0 0 3px ${p => p.theme.background};
    height: 17px;
    width: 17px;
    border-radius: 50%;
    background: ${p => p.theme.active};
    cursor: pointer;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    margin-top: -7px;
    border: 0;
  }

  &::-ms-fill-lower {
    background: ${p => p.theme.border};
    border: 0;
    border-radius: 50%;
  }

  &::-ms-fill-upper {
    background: ${p => p.theme.border};
    border: 0;
    border-radius: 50%;
  }

  &:focus {
    outline: none;

    &::-webkit-slider-runnable-track {
      background: ${p => p.theme.border};
    }

    &::-ms-fill-upper {
      background: ${p => p.theme.border};
    }

    &::-ms-fill-lower {
      background: ${p => p.theme.border};
    }
  }

  &[disabled] {
    &::-webkit-slider-thumb {
      background: ${p => p.theme.border};
      cursor: default;
    }

    &::-moz-range-thumb {
      background: ${p => p.theme.border};
      cursor: default;
    }

    &::-ms-thumb {
      background: ${p => p.theme.border};
      cursor: default;
    }

    &::-webkit-slider-runnable-track {
      cursor: default;
    }

    &::-moz-range-track {
      cursor: default;
    }

    &::-ms-track {
      cursor: default;
    }
  }
`;

const Label = styled('label')`
  font-size: 14px;
  margin-bottom: ${p => p.theme.grid}px;
  color: ${p => p.theme.subText};
`;

const SliderAndInputWrapper = styled('div')<{showCustomInput?: boolean}>`
  display: grid;
  align-items: center;
  grid-auto-flow: column;
  grid-template-columns: 4fr ${p => p.showCustomInput && '1fr'};
  grid-gap: ${space(1)};
`;
