import {Fragment, useRef, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from '@sentry/react/types/types';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import useMouseTracking from 'sentry/utils/replays/hooks/useMouseTracking';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import PerformanceScoreRing from 'sentry/views/performance/browser/webVitals/components/performanceScoreRing';
import {
  PERFORMANCE_SCORE_WEIGHTS,
  ProjectScore,
} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

import {ORDER} from '../performanceScoreChart';

import {getFormattedDuration} from './webVitalMeters';

const {
  lcp: LCP_WEIGHT,
  fcp: FCP_WEIGHT,
  fid: FID_WEIGHT,
  cls: CLS_WEIGHT,
  ttfb: TTFB_WEIGHT,
} = PERFORMANCE_SCORE_WEIGHTS;

type Coordinates = {
  x: number;
  y: number;
};

type WebVitalsLabelCoordinates = {
  [p in WebVitals]?: Coordinates;
};

type Props = {
  height: number;
  projectScore: ProjectScore;
  ringBackgroundColors: string[];
  ringSegmentColors: string[];
  text: React.ReactNode;
  width: number;
  barWidth?: number;
  hideWebVitalLabels?: boolean;
  inPerformanceWidget?: boolean;
  projectData?: TableData;
  size?: number;
  webVitalLabelCoordinates?: WebVitalsLabelCoordinates;
  x?: number;
  y?: number;
};

type WebVitalLabelProps = {
  coordinates: Coordinates;
  inPerformanceWidget: boolean;
  location: Location;
  onHover: (webVital: WebVitals) => void;
  onUnHover: () => void;
  organization: Organization;
  webVital: WebVitals;
  projectData?: TableData;
  webVitalLabelCoordinates?: WebVitalsLabelCoordinates;
};

function WebVitalLabel({
  organization,
  location,
  webVital,
  coordinates,
  onHover,
  onUnHover,
  webVitalLabelCoordinates,
  inPerformanceWidget,
  projectData,
}: WebVitalLabelProps) {
  const xOffset = webVitalLabelCoordinates?.[webVital]?.x ?? 0;
  const yOffset = webVitalLabelCoordinates?.[webVital]?.y ?? 0;
  const webvitalInfo =
    webVital === 'cls'
      ? Math.round((projectData?.data?.[0]?.['p75(measurements.cls)'] as number) * 100) /
        100
      : getFormattedDuration(
          (projectData?.data?.[0]?.[`p75(measurements.${webVital})`] as number) / 1000
        );

  return (
    <Link
      to={{
        pathname: `/organizations/${organization.slug}/performance/browser/pageloads/`,
        query: {
          ...location.query,
          webVital,
        },
      }}
      disabled={!inPerformanceWidget}
    >
      <ProgressRingText
        isLink={inPerformanceWidget}
        x={coordinates.x + xOffset}
        y={coordinates.y + yOffset}
        onMouseEnter={() => onHover(webVital)}
        onMouseLeave={() => onUnHover()}
      >
        {webVital}
      </ProgressRingText>
      {inPerformanceWidget && (
        <ProgressRingSubText
          x={coordinates.x + xOffset + (webVital === 'cls' ? 2 : 0)}
          y={coordinates.y + yOffset + 15}
        >
          {webvitalInfo}
        </ProgressRingSubText>
      )}
    </Link>
  );
}

function PerformanceScoreRingWithTooltips({
  projectScore,
  projectData,
  ringBackgroundColors,
  ringSegmentColors,
  width,
  height,
  text,
  webVitalLabelCoordinates,
  barWidth = 16,
  hideWebVitalLabels = false,
  inPerformanceWidget = false,
  size = 140,
  x = 40,
  y = 20,
}: Props) {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
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
  const [labelHovered, setLabelHovered] = useState<WebVitals | null>(null);

  if (labelHovered && inPerformanceWidget) {
    const index = ORDER.indexOf(labelHovered);
    ringSegmentColors = ringSegmentColors.map((color, i) => {
      return i === index ? color : theme.gray200;
    });
    ringBackgroundColors = ringBackgroundColors.map((color, i) => {
      return i === index ? color : `${theme.gray200}33`;
    });
  }

  const commonWebVitalLabelProps = {
    organization,
    location,
    inPerformanceWidget,
    webVitalLabelCoordinates,
    projectData,
    onHover: (webVital: WebVitals) => setLabelHovered(webVital),
    onUnHover: () => setLabelHovered(null),
  };

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
        {!hideWebVitalLabels && (
          <Fragment>
            <WebVitalLabel
              {...commonWebVitalLabelProps}
              webVital="lcp"
              coordinates={{
                x: 160,
                y: 30,
              }}
            />
            <WebVitalLabel
              {...commonWebVitalLabelProps}
              webVital="fcp"
              coordinates={{
                x: 175,
                y: 140,
              }}
            />
            <WebVitalLabel
              {...commonWebVitalLabelProps}
              webVital="fid"
              coordinates={{
                x: 20,
                y: 140,
              }}
            />
            <WebVitalLabel
              {...commonWebVitalLabelProps}
              webVital="cls"
              coordinates={{
                x: 10,
                y: 60,
              }}
            />
            <WebVitalLabel
              {...commonWebVitalLabelProps}
              webVital="ttfb"
              coordinates={{
                x: 50,
                y: 20,
              }}
            />
          </Fragment>
        )}
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
          size={size}
          barWidth={barWidth}
          textCss={() => css`
            font-size: 32px;
            font-weight: bold;
            color: ${theme.textColor};
          `}
          segmentColors={ringSegmentColors}
          backgroundColors={ringBackgroundColors}
          x={x}
          y={y}
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

const ProgressRingText = styled('text')<{isLink?: boolean}>`
  font-size: ${p => p.theme.fontSizeMedium};
  fill: ${p => (p.isLink ? p.theme.blue300 : p.theme.textColor)};
  font-weight: bold;
  text-transform: uppercase;
`;

const ProgressRingSubText = styled('text')`
  font-size: ${p => p.theme.fontSizeSmall};
  fill: ${p => p.theme.subText};
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

export default PerformanceScoreRingWithTooltips;
