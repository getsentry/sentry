import {useRef, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useMouseTracking from 'sentry/utils/replays/hooks/useMouseTracking';
import usePageFilters from 'sentry/utils/usePageFilters';
import {PerformanceScoreBreakdownChart} from 'sentry/views/performance/browser/webVitals/components/performanceScoreBreakdownChart';
import PerformanceScoreRing from 'sentry/views/performance/browser/webVitals/components/performanceScoreRing';
import {
  PERFORMANCE_SCORE_WEIGHTS,
  ProjectScore,
} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  isProjectScoreLoading?: boolean;
  projectScore?: ProjectScore;
  transaction?: string;
  webVital?: WebVitals | null;
};

const {
  lcp: LCP_WEIGHT,
  fcp: FCP_WEIGHT,
  fid: FID_WEIGHT,
  cls: CLS_WEIGHT,
  ttfb: TTFB_WEIGHT,
} = PERFORMANCE_SCORE_WEIGHTS;

const ORDER = ['lcp', 'fcp', 'fid', 'cls', 'ttfb'];

export function PerformanceScoreChart({
  projectScore,
  webVital,
  transaction,
  isProjectScoreLoading,
}: Props) {
  const theme = useTheme();
  const pageFilters = usePageFilters();

  const score = projectScore
    ? webVital
      ? projectScore[`${webVital}Score`]
      : projectScore.totalScore
    : undefined;

  let ringSegmentColors = theme.charts.getColorPalette(3);
  let ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  if (webVital) {
    const index = ORDER.indexOf(webVital);
    ringSegmentColors = ringSegmentColors.map((color, i) => {
      return i === index ? color : theme.gray200;
    });
    ringBackgroundColors = ringBackgroundColors.map((color, i) => {
      return i === index ? color : `${theme.gray200}33`;
    });
  }

  const period = pageFilters.selection.datetime.period;
  const performanceScoreSubtext = (period && DEFAULT_RELATIVE_PERIODS[period]) ?? '';

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
    <Flex>
      <PerformanceScoreLabelContainer>
        <PerformanceScoreLabel>{t('Performance Score')}</PerformanceScoreLabel>
        <PerformanceScoreSubtext>{performanceScoreSubtext}</PerformanceScoreSubtext>
        {!isProjectScoreLoading && projectScore && (
          <ProgressRingContainer ref={elem} {...mouseTrackingProps}>
            {webVitalTooltip && (
              <PerformanceScoreRingTooltip x={mousePosition.x} y={mousePosition.y}>
                <TooltipRow>
                  <span>
                    <Dot color={ringBackgroundColors[ORDER.indexOf(webVitalTooltip)]} />
                    {webVitalTooltip.toUpperCase()} {t('Opportunity')}
                  </span>
                  <TooltipValue>
                    {100 - projectScore[`${webVitalTooltip}Score`]}
                  </TooltipValue>
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
            <svg height={180} width={220}>
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
                text={score}
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
        )}
        {!isProjectScoreLoading && !projectScore && (
          <EmptyStateWarning>
            <p>{t('No Web Vitals found')}</p>
          </EmptyStateWarning>
        )}
      </PerformanceScoreLabelContainer>
      <PerformanceScoreBreakdownChart transaction={transaction} />
    </Flex>
  );
}

const Flex = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${space(2)};
  margin-top: ${space(2)};
`;

const PerformanceScoreLabelContainer = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  min-width: 320px;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  flex-direction: column;
`;

const PerformanceScoreLabel = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.textColor};
  font-weight: bold;
`;

const PerformanceScoreSubtext = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;

const ProgressRingContainer = styled('div')``;

const ProgressRingText = styled('text')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};
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
