import React from 'react';
import {getTrackBackground, Range} from 'react-range';
import {css} from '@emotion/core';

import space from 'app/styles/space';
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
  offset?: number;
  containerPadding?: string;
  onMinChange: (val: number) => void;
  onMaxChange: (val: number) => void;
  onFinalChange: (values: number[]) => void;
};

type State = {
  offset: number; // Using this to make the offset sticky
};

export function getHistogramColors() {
  const palette = theme.charts.getColorPalette(1);
  return {
    primary: palette[0],
    highlight: theme.purple200,
  };
}

function getWidth(offset: number, width: number, containerPadding = space(3)) {
  return offset
    ? `calc(100% - ${offset - 2 * parseInt(containerPadding, 10)}px);`
    : `${width}px`;
}

/**
 * This component is using react-range to provide a multi-thumb slider as this pattern may be temporary.
 * If we move this to our standard components we should re-evaluate using our own or another lib.
 */
export class HistogramChartSlider extends React.Component<Props, State> {
  state: State = {
    offset: 0,
  };
  static getDerivedStateFromProps(nextProps: Props, prevState: State): State {
    if (prevState.offset) {
      return {
        ...prevState,
      };
    }

    // Offset should be roughly equal to the charts label size, which should be always at least a few pixels wide.
    if (nextProps && nextProps.offset && nextProps.offset > 1) {
      return {
        ...prevState,
        offset: nextProps.offset,
      };
    }
    return {
      ...prevState,
    };
  }

  render() {
    const {
      width,
      min,
      max,
      step,
      minValue,
      maxValue,
      onMinChange,
      onMaxChange,
      onFinalChange,
    } = this.props;
    const {offset} = this.state;
    const primaryChartColor = getHistogramColors().primary;
    const values = [minValue, maxValue];

    const rangeMin = min ?? MIN_DEFAULT;
    const rangeMax = max ?? MAX_DEFAULT;

    return (
      <Range
        step={step || STEP_DEFAULT}
        min={rangeMin}
        max={rangeMax}
        values={values}
        onChange={([updatedMinValue, updatedMaxValue]) => {
          onMinChange(updatedMinValue);
          onMaxChange(updatedMaxValue);
        }}
        onFinalChange={onFinalChange}
        renderTrack={({props: trackProps, children}) => (
          <div
            {...trackProps}
            css={{
              ...trackProps.style,
              ...css`
                width: ${getWidth(offset, width)};
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
}
