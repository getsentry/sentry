import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Slider} from '@sentry/scraps/slider';

import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';

import {SliderAndInputWrapper} from './sliderAndInputWrapper';
import {SliderLabel} from './sliderLabel';

type SliderProps = {
  /**
   * Array of allowed values. Make sure `value` is in this list.
   * THIS NEEDS TO BE SORTED
   */
  allowedValues: number[];
  name: string;

  /**
   * String is a valid type here only for empty string
   * Otherwise react complains:
   * "`value` prop on `input` should not be null. Consider using an empty string to clear the component or `undefined` for uncontrolled components."
   *
   * And we want this to be a controlled input when value is empty
   */
  value: number | '';

  'aria-label'?: string;

  className?: string;

  /**
   * HTML id of the range input
   */
  id?: string;

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
  className,
  onChange,
  ref,
  showLabel = true,
  ...props
}: SliderProps) {
  const [sliderValue, setSliderValue] = useState(
    allowedValues.indexOf(Number(value || 0))
  );

  useEffect(() => {
    updateSliderValue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function updateSliderValue() {
    if (!defined(value)) {
      return;
    }

    const newSliderValueIndex = allowedValues.indexOf(Number(value || 0));

    // `sliderValue` represents index to `allowedValues`
    if (newSliderValueIndex > -1) {
      setSliderValue(newSliderValueIndex);
      return;
    }

    setSliderValue(value === '' ? 0 : value);
  }

  function getActualValue(newSliderValue: number): number {
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

  const actualValue = allowedValues[sliderValue];
  const min = 0;
  const max = allowedValues.length - 1;
  const displayValue = defined(actualValue) ? actualValue : t('Invalid value');
  const labelText = displayValue;

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
          aria-valuetext={String(labelText)}
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
