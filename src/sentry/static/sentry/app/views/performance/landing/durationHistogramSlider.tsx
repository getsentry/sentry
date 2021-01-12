import React from 'react';
import {getTrackBackground, Range} from 'react-range';
import {css} from '@emotion/core';

import theme from 'app/utils/theme';

const STEP_DEFAULT = 1;
const MIN_DEFAULT = 0;
const MAX_DEFAULT = 100;

type Props = {
  step?: number;
  min?: number;
  max?: number;
  minValue: number;
  maxValue: number;
  width: number;
  onMinChange: (val: number) => void;
  onMaxChange: (val: number) => void;
  onFinalChange: (values: number[]) => void;
};

export function getHistogramColors() {
  const palette = theme.charts.getColorPalette(1);
  return {
    primary: palette[0],
    highlight: theme.purple200,
  };
}

/**
 * This component is using react-range to provide a multi-thumb slider as this pattern may be temporary.
 * If we move this to our standard components we should re-evaluate using our own or another lib.
 */
export function DurationHistogramSlider(props: Props) {
  const primaryChartColor = getHistogramColors().primary;
  const values = [props.minValue, props.maxValue];

  const rangeMin = props.min || MIN_DEFAULT;
  const rangeMax = props.max || MAX_DEFAULT;

  return (
    <Range
      step={props.step || STEP_DEFAULT}
      min={rangeMin}
      max={rangeMax}
      values={values}
      onChange={([minValue, maxValue]) => {
        props.onMinChange(minValue);
        props.onMaxChange(maxValue);
      }}
      onFinalChange={props.onFinalChange}
      renderTrack={({props: trackProps, children}) => (
        <div
          {...trackProps}
          css={{
            ...trackProps.style,
            ...css`
              width: ${props.width}px;
              height: 3px;
              cursor: pointer;
              background: ${getTrackBackground({
                values,
                colors: [theme.gray100, theme.gray300, theme.gray100],
                min: rangeMin,
                max: rangeMax,
              })};
              border-radius: 3px;
              border: 0;
            `,
          }}
        >
          {children}
        </div>
      )}
      renderThumb={({props: thumbProps}) => (
        <div
          {...thumbProps}
          css={{
            ...thumbProps.style,
            ...css`
              box-shadow: 0 0 0 3px ${theme.background};
              height: 17px;
              width: 17px;
              border-radius: 50%;
              background: ${primaryChartColor};
              cursor: pointer;
              border: 0;

              &:focus {
                outline: none;
              }
            `,
          }}
        />
      )}
    />
  );
}
