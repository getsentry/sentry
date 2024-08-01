import {useRef, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useMouseTracking from 'sentry/utils/useMouseTracking';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import PerformanceScoreRing from 'sentry/views/insights/browser/webVitals/components/performanceScoreRing';
import type {PerformanceRingProps} from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';

// largely copied from performanceScoreRingWithTooltips.tsx
function ScoreRing({
  projectScore,
  ringBackgroundColors,
  ringSegmentColors,
  width,
  height,
  text,
  barWidth = 16,
  inPerformanceWidget = false,
  size = 140,
  x = 40,
  y = 25,
}: PerformanceRingProps) {
  const theme = useTheme();
  const [mousePosition, setMousePosition] = useState({x: 0, y: 0});
  const elem = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useMouseTracking({
    elem,
    onPositionChange: args => {
      if (args) {
        const {left, top} = args;
        setMousePosition({x: left, y: top});
      }
    },
  });
  const [webVitalTooltip, setWebVitalTooltip] = useState<WebVitals | null>(null);
  const [labelHovered] = useState<WebVitals | null>(null);

  const ringSegmentOrder = ORDER;

  if (labelHovered && inPerformanceWidget) {
    const index = ringSegmentOrder.indexOf(labelHovered);
    ringSegmentColors = ringSegmentColors.map((color, i) => {
      return i === index ? color : theme.gray200;
    });
    ringBackgroundColors = ringBackgroundColors.map((color, i) => {
      return i === index ? color : `${theme.gray200}33`;
    });
  }

  const weights = PERFORMANCE_SCORE_WEIGHTS;

  return (
    <div ref={elem} {...mouseTrackingProps}>
      {webVitalTooltip && (
        <PerformanceScoreRingTooltip x={mousePosition.x} y={mousePosition.y}>
          <TooltipRow>
            <span>
              <Dot
                color={ringBackgroundColors[ringSegmentOrder.indexOf(webVitalTooltip)]}
              />
              {webVitalTooltip.toUpperCase()} {t('Opportunity')}
            </span>
            <TooltipValue>
              {100 - (projectScore[`${webVitalTooltip}Score`] ?? 0)}
            </TooltipValue>
          </TooltipRow>
          <TooltipRow>
            <span>
              <Dot color={ringSegmentColors[ringSegmentOrder.indexOf(webVitalTooltip)]} />
              {webVitalTooltip.toUpperCase()} {t('Score')}
            </span>
            <TooltipValue>{projectScore[`${webVitalTooltip}Score`]}</TooltipValue>
          </TooltipRow>
          <PerformanceScoreRingTooltipArrow />
        </PerformanceScoreRingTooltip>
      )}
      <svg height={height} width={width}>
        <PerformanceScoreRing
          values={[
            {
              value: (projectScore.lcpScore ?? 0) * weights.lcp * 0.01,
              maxValue: weights.lcp,
              key: 'lcp',
              onHoverActions: () => setWebVitalTooltip('lcp'),
            },
            {
              value: (projectScore.fcpScore ?? 0) * weights.fcp * 0.01,
              maxValue: weights.fcp,
              key: 'fcp',
              onHoverActions: () => setWebVitalTooltip('fcp'),
            },
            {
              value: (projectScore.inpScore ?? 0) * weights.inp * 0.01,
              maxValue: weights.inp,
              key: 'inp',
              onHoverActions: () => setWebVitalTooltip('inp'),
            },
            {
              value: (projectScore.clsScore ?? 0) * weights.cls * 0.01,
              maxValue: weights.cls,
              key: 'cls',
              onHoverActions: () => setWebVitalTooltip('cls'),
            },
            {
              value: (projectScore.ttfbScore ?? 0) * weights.ttfb * 0.01,
              maxValue: weights.ttfb,
              key: 'ttfb',
              onHoverActions: () => setWebVitalTooltip('ttfb'),
            },
          ]}
          text={text}
          size={size}
          barWidth={barWidth}
          textCss={() => css`
            font-size: 32px;
            font-weight: ${theme.fontWeightBold};
            color: ${theme.textColor};
          `}
          segmentColors={ringSegmentColors}
          backgroundColors={ringBackgroundColors}
          x={x}
          y={y}
          onUnhover={() => setWebVitalTooltip(null)}
        />
      </svg>
    </div>
  );
}

// Hover element on mouse
const PerformanceScoreRingTooltip = styled('div')<{x: number; y: number}>`
  position: absolute;
  background: ${p => p.theme.backgroundElevated};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.gray200};
  transform: translate3d(${p => p.x - 100}px, ${p => p.y - 74}px, 0px);
  padding: ${space(1)} ${space(2)};
  width: 200px;
  height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

const PerformanceScoreRingTooltipArrow = styled('div')`
  top: 100%;
  left: 50%;
  position: absolute;
  pointer-events: none;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid ${p => p.theme.backgroundElevated};
  margin-left: -8px;
  &:before {
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid ${p => p.theme.translucentBorder};
    content: '';
    display: block;
    position: absolute;
    top: -7px;
    left: -8px;
    z-index: -1;
  }
`;

const Dot = styled('span')<{color: string}>`
  display: inline-block;
  margin-right: ${space(0.5)};
  border-radius: 10px;
  width: 10px;
  height: 10px;
  background-color: ${p => p.color};
`;

const TooltipRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const TooltipValue = styled('span')`
  color: ${p => p.theme.gray300};
`;

export default ScoreRing;
