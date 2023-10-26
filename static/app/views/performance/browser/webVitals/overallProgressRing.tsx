import {useRef, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useMouseTracking from 'sentry/utils/replays/hooks/useMouseTracking';
import PerformanceScoreRing from 'sentry/views/performance/browser/webVitals/components/performanceScoreRing';
import {
  PERFORMANCE_SCORE_WEIGHTS,
  ProjectScore,
} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

import {ORDER} from './performanceScoreChart';

const {
  lcp: LCP_WEIGHT,
  fcp: FCP_WEIGHT,
  fid: FID_WEIGHT,
  cls: CLS_WEIGHT,
  ttfb: TTFB_WEIGHT,
} = PERFORMANCE_SCORE_WEIGHTS;

type Props = {
  height: number;
  projectScore: ProjectScore;
  ringBackgroundColors: string[];
  ringSegmentColors: string[];
  text: React.ReactNode;
  width: number;
};

function OverallProgressRing({
  projectScore,
  ringBackgroundColors,
  ringSegmentColors,
  width,
  height,
  text,
}: Props) {
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

  return (
    <ProgressRingContainer ref={elem} {...mouseTrackingProps}>
      {webVitalTooltip && (
        <PerformanceScoreRingTooltip x={mousePosition.x} y={mousePosition.y}>
          <TooltipRow>
            <span>
              <Dot color={ringBackgroundColors[ORDER.indexOf(webVitalTooltip)]} />
              {webVitalTooltip.toUpperCase()} {t('Opportunity')}
            </span>
            <TooltipValue>{100 - projectScore[`${webVitalTooltip}Score`]}</TooltipValue>
          </TooltipRow>
          <TooltipRow>
            <span>
              <Dot color={ringSegmentColors[ORDER.indexOf(webVitalTooltip)]} />
              {webVitalTooltip.toUpperCase()} {t('Score')}
            </span>
            <TooltipValue>{projectScore[`${webVitalTooltip}Score`]}</TooltipValue>
          </TooltipRow>
          <PerformanceScoreRingTooltipArrow />
        </PerformanceScoreRingTooltip>
      )}
      <svg height={height} width={width}>
        <ProgressRingText x={160} y={30}>
          LCP
        </ProgressRingText>
        <ProgressRingText x={175} y={140}>
          FCP
        </ProgressRingText>
        <ProgressRingText x={20} y={140}>
          FID
        </ProgressRingText>
        <ProgressRingText x={10} y={60}>
          CLS
        </ProgressRingText>
        <ProgressRingText x={50} y={20}>
          TTFB
        </ProgressRingText>
        <PerformanceScoreRing
          values={[
            projectScore.lcpScore * LCP_WEIGHT * 0.01,
            projectScore.fcpScore * FCP_WEIGHT * 0.01,
            projectScore.fidScore * FID_WEIGHT * 0.01,
            projectScore.clsScore * CLS_WEIGHT * 0.01,
            projectScore.ttfbScore * TTFB_WEIGHT * 0.01,
          ]}
          maxValues={[LCP_WEIGHT, FCP_WEIGHT, FID_WEIGHT, CLS_WEIGHT, TTFB_WEIGHT]}
          text={text}
          size={140}
          barWidth={14}
          textCss={() => css`
            font-size: 32px;
            font-weight: bold;
            color: ${theme.textColor};
          `}
          segmentColors={ringSegmentColors}
          backgroundColors={ringBackgroundColors}
          x={40}
          y={20}
          onHoverActions={[
            () => setWebVitalTooltip('lcp'),
            () => setWebVitalTooltip('fcp'),
            () => setWebVitalTooltip('fid'),
            () => setWebVitalTooltip('cls'),
            () => setWebVitalTooltip('ttfb'),
          ]}
          onUnhover={() => setWebVitalTooltip(null)}
        />
      </svg>
    </ProgressRingContainer>
  );
}

const ProgressRingContainer = styled('div')``;

const ProgressRingText = styled('text')`
  font-size: ${p => p.theme.fontSizeMedium};
  fill: ${p => p.theme.textColor};
  font-weight: bold;
`;

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

export default OverallProgressRing;
