import {forwardRef as reactFowardRef, useEffect, useState} from 'react';

import Input from 'sentry/components/forms/controls/input';
import Slider from 'sentry/components/forms/controls/rangeSlider/slider';
import SliderAndInputWrapper from 'sentry/components/forms/controls/rangeSlider/sliderAndInputWrapper';
import SliderLabel from 'sentry/components/forms/controls/rangeSlider/sliderLabel';
import type SliderProps from 'sentry/components/forms/controls/rangeSlider/sliderProps';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

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
}: SliderProps) {
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

  function getActualValue(newSliderValue: SliderProps['value']): SliderProps['value'] {
    if (!allowedValues) {
      return newSliderValue;
    }

    // If `allowedValues` is defined, then `sliderValue` represents index to `allowedValues`
    return allowedValues[newSliderValue];
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const newSliderValue = parseInt(e.target.value, 10);
    setSliderValue(newSliderValue);
    onChange?.(getActualValue(newSliderValue), e);
  }

  function handleCustomInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSliderValue(parseInt(e.target.value, 10) || 0);
  }

  function handleBlur(
    e: React.MouseEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>
  ) {
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
        <SliderLabel htmlFor={name}>
          {formatLabel?.(actualValue) ?? displayValue}
        </SliderLabel>
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

const RangeSliderContainer = reactFowardRef(function RangeSliderContainer(
  props: SliderProps,
  ref: React.Ref<any>
) {
  return <RangeSlider {...props} forwardRef={ref} />;
});

export default RangeSliderContainer;
