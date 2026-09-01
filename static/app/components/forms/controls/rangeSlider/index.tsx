import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Slider} from '@sentry/scraps/slider';

import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';

import {SliderAndInputWrapper} from './sliderAndInputWrapper';
import {SliderLabel} from './sliderLabel';

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

  'aria-label'?: string;

  className?: string;

  /**
   * Render prop for slider's label
   * Is passed the value as an argument
   */
  formatLabel?: (value: number | '') => React.ReactNode;

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

  onChange?: (
    value: SliderProps['value'],
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Show label with current value
   */
  showLabel?: boolean;
};

export function RangeSlider({
  id,
  value,
  allowedValues,
  name,
  formatLabel,
  className,
  onChange,
  ref,
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

  function getActualValue(newSliderValue: number): number {
    if (!allowedValues) {
      return newSliderValue;
    }

    // If `allowedValues` is defined, then `sliderValue` represents index to `allowedValues`
    return allowedValues[newSliderValue]!;
  }

  function handleSliderChange(newSliderValue: number) {
    setSliderValue(newSliderValue);
    // Legacy onChange takes (value, event) but the new Slider no longer provides an event.
    // Pass a synthetic-like object for backward compat with callers that destructure the event.
    onChange?.(getActualValue(newSliderValue), {
      currentTarget: {valueAsNumber: newSliderValue},
    } as React.ChangeEvent<HTMLInputElement>);
  }

  function getSliderData() {
    if (!allowedValues) {
      const {min, max} = props;
      return {
        min,
        max,
        actualValue: sliderValue,
        displayValue: sliderValue,
      };
    }

    // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
    const actualValue = allowedValues[sliderValue];

    return {
      min: 0,
      max: allowedValues.length - 1,
      actualValue,
      displayValue: defined(actualValue) ? actualValue : t('Invalid value'),
    };
  }

  const {min, max, actualValue, displayValue} = getSliderData();
  const labelText = formatLabel?.(actualValue) ?? displayValue;

  return (
    <div className={className} ref={ref}>
      {showLabel && <SliderLabel>{labelText}</SliderLabel>}
      <SliderAndInputWrapper>
        <StyledSlider
          name={name}
          id={id}
          min={min}
          max={max}
          onChange={handleSliderChange}
          value={sliderValue}
          aria-valuetext={labelText}
          aria-label={props['aria-label']}
          formatOptions={showLabel ? undefined : 'hidden'}
        />
      </SliderAndInputWrapper>
    </div>
  );
}

const StyledSlider = styled(Slider)`
  margin: ${p => p.theme.space.md} 0;
`;
