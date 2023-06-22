import {forwardRef as reactForwardRef, useEffect, useState} from 'react';

import Input from 'sentry/components/input';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

import Slider from './slider';
import SliderAndInputWrapper from './sliderAndInputWrapper';
import SliderLabel from './sliderLabel';

type SliderProps = {
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
   * Array of allowed values. Make sure `value` is in this list.
   * THIS NEEDS TO BE SORTED
   */
  allowedValues?: number[];

  className?: string;

  disabled?: boolean;

  disabledReason?: React.ReactNode;
  /**
   * Render prop for slider's label
   * Is passed the value as an argument
   */
  formatLabel?: (value: number | '') => React.ReactNode;

  forwardRef?: React.Ref<HTMLDivElement>;

  /**
   * HTML id of the range input
   */
  id?: string;

  /**
   * max allowed value, not needed if using `allowedValues`
   */
  max?: number;
  /**
   * min allowed value, not needed if using `allowedValues`
   */
  min?: number;

  /**
   * This is called when *any* MouseUp or KeyUp event happens.
   * Used for "smart" Fields to trigger a "blur" event. `onChange` can
   * be triggered quite frequently
   */
  onBlur?: (
    event: React.MouseEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>
  ) => void;

  onChange?: (
    value: SliderProps['value'],
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  /**
   * Placeholder for custom input
   */
  placeholder?: string;
  /**
   * Show input control for custom values
   */
  showCustomInput?: boolean;
  /**
   * Show label with current value
   */
  showLabel?: boolean;
  step?: number;
};

function RangeSlider({
  id,
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
  disabledReason,
  showLabel = true,
  ...props
}: SliderProps) {
  const [sliderValue, setSliderValue] = useState(
    allowedValues ? allowedValues.indexOf(Number(value || 0)) : value
  );

  useEffect(() => {
    updateSliderValue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const newSliderValue = parseFloat(e.target.value);
    setSliderValue(newSliderValue);
    onChange?.(getActualValue(newSliderValue), e);
  }

  function handleCustomInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSliderValue(parseFloat(e.target.value) || 0);
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
  const labelText = formatLabel?.(actualValue) ?? displayValue;

  return (
    <div className={className} ref={forwardRef}>
      {!showCustomInput && showLabel && <SliderLabel>{labelText}</SliderLabel>}
      <Tooltip title={disabledReason} disabled={!disabled} skipWrapper isHoverable>
        <SliderAndInputWrapper showCustomInput={showCustomInput}>
          <Slider
            type="range"
            name={name}
            id={id}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={handleInput}
            onInput={handleInput}
            onMouseUp={handleBlur}
            onKeyUp={handleBlur}
            value={sliderValue}
            hasLabel={!showCustomInput}
            aria-valuetext={labelText}
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
      </Tooltip>
    </div>
  );
}

const RangeSliderContainer = reactForwardRef(function RangeSliderContainer(
  props: SliderProps,
  ref: React.Ref<any>
) {
  return <RangeSlider {...props} forwardRef={ref} />;
});

export default RangeSliderContainer;

export type {SliderProps};
