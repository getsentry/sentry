// wip inspired by https://github.com/kevinsqi/react-circular-progressbar

import * as React from 'react';
import styled from '@emotion/styled';

export const VIEWBOX_WIDTH = 20;
export const VIEWBOX_HEIGHT = 20;
export const VIEWBOX_HEIGHT_HALF = 10;
export const VIEWBOX_CENTER_X = 10;
export const VIEWBOX_CENTER_Y = 10;

export type CircularProgressbarDefaultProps = {
  background: boolean;
  backgroundPadding: number;
  circleRatio: number;
  classes: {
    root: string;
    trail: string;
    path: string;
    text: string;
    background: string;
  };
  className: string;
  counterClockwise: boolean;
  maxValue: number;
  minValue: number;
  strokeWidth: number;
  text: string;
};

function Path({
  className,
  counterClockwise,
  dashRatio,
  pathRadius,
  strokeWidth,
  style,
}: {
  className?: string;
  counterClockwise: boolean;
  dashRatio: number;
  pathRadius: number;
  strokeWidth: number;
  style?: object;
}) {
  return (
    <path
      className={className}
      style={Object.assign(
        {},
        style,
        getDashStyle({pathRadius, dashRatio, counterClockwise})
      )}
      d={getPathDescription({
        pathRadius,
        counterClockwise,
      })}
      strokeWidth={strokeWidth}
      fillOpacity={0}
    />
  );
}

// SVG path description specifies how the path should be drawn
function getPathDescription({
  pathRadius,
  counterClockwise,
}: {
  pathRadius: number;
  counterClockwise: boolean;
}) {
  const radius = pathRadius;
  const rotation = counterClockwise ? 1 : 0;

  // Move to center of canvas
  // Relative move to top canvas
  // Relative arc to bottom of canvas
  // Relative arc to top of canvas
  return `
        M ${VIEWBOX_CENTER_X},${VIEWBOX_CENTER_Y}
        m 0,-${radius}
        a ${radius},${radius} ${rotation} 1 1 0,${2 * radius}
        a ${radius},${radius} ${rotation} 1 1 0,-${2 * radius}
      `;
}

function getDashStyle({
  counterClockwise,
  dashRatio,
  pathRadius,
}: {
  counterClockwise: boolean;
  dashRatio: number;
  pathRadius: number;
}) {
  const diameter = Math.PI * 2 * pathRadius;
  const gapLength = (1 - dashRatio) * diameter;

  return {
    // Have dash be full diameter, and gap be full diameter
    strokeDasharray: `${diameter}px ${diameter}px`,
    // Shift dash backward by gapLength, so gap starts appearing at correct distance
    strokeDashoffset: `${counterClockwise ? -gapLength : gapLength}px`,
  };
}

class CircularProgressbar extends React.Component<
  CircularProgressbarDefaultProps & {value: number}
> {
  static defaultProps: CircularProgressbarDefaultProps = {
    background: false,
    backgroundPadding: 0,
    circleRatio: 1,
    classes: {
      root: 'CircularProgressbar',
      trail: 'CircularProgressbar-trail',
      path: 'CircularProgressbar-path',
      text: 'CircularProgressbar-text',
      background: 'CircularProgressbar-background',
    },
    counterClockwise: false,
    className: '',
    maxValue: 100,
    minValue: 0,
    strokeWidth: 3,
    text: '',
  };

  getBackgroundPadding() {
    if (!this.props.background) {
      // Don't add padding if not displaying background
      return 0;
    }
    return this.props.backgroundPadding;
  }

  getPathRadius() {
    // The radius of the path is defined to be in the middle, so in order for the path to
    // fit perfectly inside the 100x100 viewBox, need to subtract half the strokeWidth
    return VIEWBOX_HEIGHT_HALF - this.props.strokeWidth / 2 - this.getBackgroundPadding();
  }

  // Ratio of path length to trail length, as a value between 0 and 1
  getPathRatio() {
    const {value, minValue, maxValue} = this.props;
    const boundedValue = Math.min(Math.max(value, minValue), maxValue);
    return (boundedValue - minValue) / (maxValue - minValue);
  }

  render() {
    const {
      circleRatio,
      className,
      classes,
      counterClockwise,
      strokeWidth,
      text,
      value,
    } = this.props;

    const pathRadius = this.getPathRadius();
    const pathRatio = this.getPathRatio();

    return (
      <CircleWrapper progress={value}>
        <svg
          className={`${classes.root} ${className}`}
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          data-test-id="CircularProgressbar"
        >
          {this.props.background ? (
            <circle
              className={classes.background}
              cx={VIEWBOX_CENTER_X}
              cy={VIEWBOX_CENTER_Y}
              r={VIEWBOX_HEIGHT_HALF}
            />
          ) : null}

          <Path
            className={classes.trail}
            counterClockwise={counterClockwise}
            dashRatio={circleRatio}
            pathRadius={pathRadius}
            strokeWidth={strokeWidth}
          />

          <Path
            className={classes.path}
            counterClockwise={counterClockwise}
            dashRatio={pathRatio * circleRatio}
            pathRadius={pathRadius}
            strokeWidth={strokeWidth}
          />

          {text ? (
            <text className={classes.text} x={VIEWBOX_CENTER_X} y={VIEWBOX_CENTER_Y}>
              {text}
            </text>
          ) : null}
        </svg>
      </CircleWrapper>
    );
  }
}

const getColor = ({progress, theme}) => {
  if (progress < 33) {
    return theme.red;
  }
  if (progress < 66) {
    return theme.yellowOrange;
  }
  if (progress >= 66) {
    return theme.green;
  }

  return theme.gray3;
};

const CircleWrapper = styled('div')<{progress: number}>`
  display: inline-block;
  position: relative;
  bottom: 2px;
  /*
 * react-circular-progressbar styles
 * All of the styles in this file are configurable!
 */

  .CircularProgressbar {
    /*
   * This fixes an issue where the CircularProgressbar svg has
   * 0 width inside a "display: flex" container, and thus not visible.
   */
    width: 20px;
    /*
   * This fixes a centering issue with CircularProgressbarWithChildren:
   * https://github.com/kevinsqi/react-circular-progressbar/issues/94
   */
    vertical-align: middle;
  }

  .CircularProgressbar .CircularProgressbar-path {
    stroke: ${getColor};
    /* stroke-linecap: round; */
    transition: stroke-dashoffset 0.5s ease 0s;
  }

  .CircularProgressbar .CircularProgressbar-trail {
    stroke: #d6d6d6;
    /* Used when trail is not full diameter, i.e. when props.circleRatio is set */
    /* stroke-linecap: round; */
  }

  .CircularProgressbar .CircularProgressbar-text {
    fill: ${getColor};
    font-size: 20px;
    dominant-baseline: middle;
    text-anchor: middle;
  }

  .CircularProgressbar .CircularProgressbar-background {
    fill: #d6d6d6;
  }

  /*
 * Sample background styles. Use these with e.g.:
 *
 *   <CircularProgressbar
 *     className="CircularProgressbar-inverted"
 *     background
 *     percentage={50}
 *   />
 */
  .CircularProgressbar.CircularProgressbar-inverted .CircularProgressbar-background {
    fill: ${getColor};
  }

  .CircularProgressbar.CircularProgressbar-inverted .CircularProgressbar-text {
    fill: #fff;
  }

  .CircularProgressbar.CircularProgressbar-inverted .CircularProgressbar-path {
    stroke: #fff;
  }

  .CircularProgressbar.CircularProgressbar-inverted .CircularProgressbar-trail {
    stroke: transparent;
  }
`;

export default CircularProgressbar;
