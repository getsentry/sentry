import React from 'react';
import styled, {SerializedStyles} from '@emotion/styled';
import posed, {PoseGroup} from 'react-pose';

import theme from 'app/utils/theme';
import testablePose from 'app/utils/testablePose';

type TextProps = {
  textCss?: Props['textCss'];
  percent: number;
  theme: typeof theme;
};

type Props = React.HTMLAttributes<SVGSVGElement> & {
  value: number;
  maxValue?: number;
  minValue?: number;
  size?: number;
  /**
   * The width of the progress ring bar
   */
  barWidth?: number;
  /**
   * Text to display in the center of the ring
   */
  text?: React.ReactNode;
  /**
   * The css to apply to the center text. A function may be provided to compute
   * styles based on the state of the progress bar.
   */
  textCss?: (p: TextProps) => SerializedStyles;
  /**
   * Apply a micro animation when the text value changes
   */
  animateText?: boolean;
  /**
   * The color of the ring bar. A function may be provided to compute the color
   * based on the percent value filled of the progress bar.
   */
  progressColor?: string | ((opts: {percent: number}) => string);
  /**
   * The color of the ring background
   */
  backgroundColor?: string;
};

const Text = styled('text')<Omit<TextProps, 'theme'>>`
  fill: ${p => p.theme.gray1};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-anchor: middle;
  dominant-baseline: central;
  transition: fill 100ms;
  ${p => p.textCss && p.textCss(p)}
`;

const PosedText = posed(Text)(
  testablePose({
    init: {opacity: 0, y: -10},
    enter: {opacity: 1, y: 0},
    exit: {opacity: 0, y: 10},
  })
);

const ProgressRing = ({
  value,
  minValue = 0,
  maxValue = 100,
  size = 20,
  barWidth = 3,
  text,
  textCss,
  animateText = false,
  progressColor = theme.green,
  backgroundColor = theme.offWhite2,
  ...p
}: Props) => {
  const radius = size / 2 - barWidth / 2;
  const circumference = 2 * Math.PI * radius;

  const boundedValue = Math.min(Math.max(value, minValue), maxValue);
  const progress = (boundedValue - minValue) / (maxValue - minValue);
  const percent = progress * 100;
  const progressOffset = (1 - progress) * circumference;

  const TextComponent = animateText ? PosedText : Text;

  let textNode = (
    <TextComponent key={text?.toString()} x="50%" y="50%" {...{textCss, percent}}>
      {text}
    </TextComponent>
  );

  textNode = animateText ? (
    <PoseGroup preEnterPose="init">{textNode}</PoseGroup>
  ) : (
    textNode
  );

  const ringColor =
    typeof progressColor === 'function' ? progressColor({percent}) : progressColor;

  return (
    <svg height={radius * 2 + barWidth} width={radius * 2 + barWidth} {...p}>
      {text !== undefined && textNode}
      <RingBackground
        r={radius}
        barWidth={barWidth}
        cx={radius + barWidth / 2}
        cy={radius + barWidth / 2}
        color={backgroundColor}
      />
      <RingBar
        strokeDashoffset={progressOffset}
        circumference={circumference}
        r={radius}
        barWidth={barWidth}
        cx={radius + barWidth / 2}
        cy={radius + barWidth / 2}
        color={ringColor}
      />
    </svg>
  );
};

const RingBackground = styled('circle')<{color: string; barWidth: number}>`
  fill: none;
  stroke: ${p => p.color};
  stroke-width: ${p => p.barWidth}px;
  transition: stroke 100ms;
`;

const RingBar = styled('circle')<{
  color: string;
  circumference: number;
  barWidth: number;
}>`
  fill: none;
  stroke: ${p => p.color};
  stroke-width: ${p => p.barWidth}px;
  stroke-dasharray: ${p => p.circumference} ${p => p.circumference};
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
  transition: stroke-dashoffset 200ms, stroke 100ms;
`;

export default ProgressRing;

// We export components to allow for css selectors
export {RingBar, RingBackground, Text as RingText};
