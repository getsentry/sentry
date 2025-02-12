import {useMemo} from 'react';
import type {SerializedStyles, Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import testableTransition from 'sentry/utils/testableTransition';

type TextProps = {
  percent: number;
  theme: Theme;
  textCss?: Props['textCss'];
};

type Props = React.HTMLAttributes<SVGSVGElement> & {
  value: number;
  /**
   * Enables subtle animations for both the text value change and the progress ring update.
   */
  animate?: boolean;
  /**
   * The color of the ring background
   */
  backgroundColor?: string;
  /**
   * The width of the progress ring bar
   */
  barWidth?: number;
  maxValue?: number;
  minValue?: number;
  /**
   * The color of the ring bar. A function may be provided to compute the color
   * based on the percent value filled of the progress bar.
   */
  progressColor?: string;
  /**
   * Endcaps on the progress bar
   */
  progressEndcaps?: React.SVGAttributes<SVGCircleElement>['strokeLinecap'];
  size?: number;
  /**
   * Text to display in the center of the ring
   */
  text?: React.ReactNode;
  /**
   * The css to apply to the center text. A function may be provided to compute
   * styles based on the state of the progress bar.
   */
  textCss?: (p: TextProps) => SerializedStyles;
};

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
  ${p => p.textCss?.(p)}
`;

const AnimatedText = motion(Text);

const animatedTextDefaultProps = {
  initial: {opacity: 0, y: -10},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 10},
  transition: testableTransition(),
};

function ProgressRing({
  value,
  minValue = 0,
  maxValue = 100,
  size = 20,
  barWidth = 3,
  text,
  textCss,
  animate = false,
  progressEndcaps,
  ...p
}: Props) {
  const theme = useTheme();
  const progressColor = p.progressColor ?? theme.green300;
  const backgroundColor = p.backgroundColor ?? theme.gray200;
  const radius = size / 2 - barWidth / 2;
  const circumference = 2 * Math.PI * radius;

  const boundedValue = Math.min(Math.max(value, minValue), maxValue);
  const progress = (boundedValue - minValue) / (maxValue - minValue);
  const percent = progress * 100;
  const progressOffset = (1 - progress) * circumference;

  const TextComponent = animate ? AnimatedText : Text;

  let textNode = (
    <TextComponent
      key={text?.toString()}
      {...(animate ? animatedTextDefaultProps : {})}
      {...{textCss, percent}}
    >
      {text}
    </TextComponent>
  );

  textNode = animate ? (
    <AnimatePresence initial={false}>{textNode}</AnimatePresence>
  ) : (
    textNode
  );

  const ringCommonProps = useMemo(() => {
    return {
      strokeDashoffset: progressOffset,
      strokeLinecap: progressEndcaps,
      circumference,
      r: radius,
      barWidth,
      cx: radius + barWidth / 2,
      cy: radius + barWidth / 2,
      color: progressColor,
    };
  }, [progressOffset, progressEndcaps, circumference, radius, barWidth, progressColor]);

  return (
    <RingSvg
      role="img"
      height={radius * 2 + barWidth}
      width={radius * 2 + barWidth}
      {...p}
    >
      <RingBackground
        r={radius}
        barWidth={barWidth}
        cx={radius + barWidth / 2}
        cy={radius + barWidth / 2}
        color={backgroundColor}
      />
      {animate ? (
        <MotionRingBar
          {...ringCommonProps}
          initial={{strokeDashoffset: circumference}}
          animate={{strokeDashoffset: progressOffset}}
          transition={{duration: 1.5, ease: 'easeInOut'}}
        />
      ) : (
        <RingBar {...ringCommonProps} />
      )}
      <foreignObject height="100%" width="100%">
        {text !== undefined && textNode}
      </foreignObject>
    </RingSvg>
  );
}

const RingSvg = styled('svg')`
  position: relative;
`;

const RingBackground = styled('circle')<{barWidth: number; color: string}>`
  fill: none;
  stroke: ${p => p.color};
  stroke-width: ${p => p.barWidth}px;
  transition: stroke 100ms;
`;

const RingBar = styled('circle')<{
  barWidth: number;
  circumference: number;
  color: string;
}>`
  fill: none;
  stroke: ${p => p.color};
  stroke-width: ${p => p.barWidth}px;
  stroke-dasharray: ${p => p.circumference} ${p => p.circumference};
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
  transition:
    stroke-dashoffset 200ms,
    stroke 100ms;
`;

const MotionRingBar = motion(RingBar);

export default ProgressRing;

// We export components to allow for css selectors
export {RingBackground, RingBar, Text as RingText};
