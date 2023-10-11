import {SerializedStyles, Theme} from '@emotion/react';
import styled from '@emotion/styled';

type TextProps = {
  theme: Theme;
  textCss?: Props['textCss'];
};

type Props = React.HTMLAttributes<SVGSVGElement> & {
  backgroundColors: string[];
  maxValues: number[];
  segmentColors: string[];
  text: React.ReactNode;
  values: number[];
  /**
   * The width of the progress ring bar
   */
  barWidth?: number;
  onHoverActions?: (() => void)[];
  onUnhover?: () => void;
  /**
   * Endcaps on the progress bar
   */
  progressEndcaps?: React.SVGAttributes<SVGCircleElement>['strokeLinecap'];
  size?: number;
  /**
   * The css to apply to the center text. A function may be provided to compute
   * styles based on the state of the progress bar.
   */
  textCss?: (p: TextProps) => SerializedStyles;
  x?: number;
  y?: number;
};

const BASE_ROTATE = -90;
const PADDING = 1;

const Text = styled('div')<Omit<TextProps, 'theme'>>`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  color: ${p => p.theme.chartLabel};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  transition: color 100ms;
  ${p => p.textCss && p.textCss(p)}
`;

function PerformanceScoreRing({
  values,
  maxValues,
  size = 20,
  barWidth = 3,
  text,
  textCss,
  segmentColors,
  backgroundColors,
  progressEndcaps,
  onHoverActions,
  onUnhover,
  ...p
}: Props) {
  const textNode = (
    <Text key={text?.toString()} {...{textCss}}>
      {text}
    </Text>
  );

  const foreignObjectSize = size / 2;
  const foreignObjectOffset = size / 4;

  const radius = size / 2 - barWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const sumMaxValues = maxValues.reduce((acc, val) => acc + val, 0);

  const rings: React.ReactNode[] = [];
  let currentRotate = BASE_ROTATE;

  maxValues.forEach((maxValue, index) => {
    const boundedValue = Math.min(Math.max(values[index], 0), maxValue);
    // TODO: Hacky way to add padding to ring segments. Should clean this up so it's more accurate.
    const maxOffset = (1 - (maxValue - PADDING) / sumMaxValues) * circumference;
    const progressOffset = (1 - (boundedValue - PADDING) / sumMaxValues) * circumference;
    const rotate = currentRotate;
    currentRotate += (360 * maxValue) / sumMaxValues;

    rings.push(
      <RingBackground
        strokeDashoffset={maxOffset}
        r={radius}
        barWidth={barWidth}
        circumference={circumference}
        cx={radius + barWidth / 2}
        cy={radius + barWidth / 2}
        color={backgroundColors[index]}
        rotate={rotate}
        onMouseOver={() => onHoverActions?.[index]()}
        onMouseLeave={() => onUnhover?.()}
      />
    );
    rings.push(
      <RingBar
        strokeDashoffset={progressOffset}
        strokeLinecap={progressEndcaps}
        circumference={circumference}
        r={radius}
        barWidth={barWidth}
        cx={radius + barWidth / 2}
        cy={radius + barWidth / 2}
        color={segmentColors[index]}
        rotate={rotate}
        onMouseOver={() => onHoverActions?.[index]()}
        onMouseLeave={() => onUnhover?.()}
      />
    );
  });

  return (
    <RingSvg
      role="img"
      height={radius * 2 + barWidth}
      width={radius * 2 + barWidth}
      {...p}
    >
      {rings}
      <foreignObject
        height={foreignObjectSize}
        width={foreignObjectSize}
        x={foreignObjectOffset}
        y={foreignObjectOffset}
      >
        {text !== undefined && textNode}
      </foreignObject>
    </RingSvg>
  );
}

const RingSvg = styled('svg')`
  position: relative;
`;

const RingBackground = styled('circle')<{
  barWidth: number;
  circumference: number;
  color: string;
  rotate: number;
}>`
  fill: none;
  stroke: ${p => p.color};
  stroke-width: ${p => p.barWidth}px;
  stroke-dasharray: ${p => p.circumference} ${p => p.circumference};
  transform: rotate(${p => p.rotate}deg);
  transform-origin: 50% 50%;
  transition: stroke 100ms;
`;

const RingBar = styled('circle')<{
  barWidth: number;
  circumference: number;
  color: string;
  rotate: number;
}>`
  fill: none;
  stroke: ${p => p.color};
  stroke-width: ${p => p.barWidth}px;
  stroke-dasharray: ${p => p.circumference} ${p => p.circumference};
  transform: rotate(${p => p.rotate}deg);
  transform-origin: 50% 50%;
  transition:
    stroke-dashoffset 200ms,
    stroke 100ms;
`;

export default PerformanceScoreRing;

// We export components to allow for css selectors
export {RingBackground, RingBar, Text as RingText};
