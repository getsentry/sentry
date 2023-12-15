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
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {
  ProjectScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';

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
  labelHeightPadding?: number;
  labelWidthPadding?: number;
  projectData?: TableData;
  radiusPadding?: number;
  size?: number;
  webVitalLabelCoordinates?: WebVitalsLabelCoordinates;
  weights?: {
    [key in WebVitals]: number;
  };
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
      onMouseEnter={() => onHover(webVital)}
      onMouseLeave={() => onUnHover()}
      disabled={!inPerformanceWidget}
    >
      <ProgressRingText
        isLink={inPerformanceWidget}
        x={coordinates.x + xOffset}
        y={coordinates.y + yOffset}
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
  weights = {
    lcp: LCP_WEIGHT,
    fcp: FCP_WEIGHT,
    fid: FID_WEIGHT,
    cls: CLS_WEIGHT,
    ttfb: TTFB_WEIGHT,
  },
  barWidth = 16,
  hideWebVitalLabels = false,
  inPerformanceWidget = false,
  size = 140,
  x = 40,
  y = 25,
  labelWidthPadding = 28,
  labelHeightPadding = 14,
  radiusPadding = 4,
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

  const {lcpX, lcpY, fcpX, fcpY, fidX, fidY, clsX, clsY, ttfbX, ttfbY} =
    calculateLabelCoordinates(
      size,
      x,
      y,
      barWidth,
      weights,
      labelWidthPadding,
      labelHeightPadding,
      radiusPadding
    );

  return (
    <ProgressRingContainer ref={elem} {...mouseTrackingProps}>
      {webVitalTooltip && (
        <PerformanceScoreRingTooltip x={mousePosition.x} y={mousePosition.y}>
          <TooltipRow>
            <span>
              <Dot color={ringBackgroundColors[ORDER.indexOf(webVitalTooltip)]} />
              {webVitalTooltip.toUpperCase()} {t('Opportunity')}
            </span>
            <TooltipValue>
              {100 - (projectScore[`${webVitalTooltip}Score`] ?? 0)}
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
      <svg height={height} width={width}>
        {!hideWebVitalLabels && (
          <Fragment>
            <WebVitalLabel
              {...commonWebVitalLabelProps}
              webVital="lcp"
              coordinates={{
                x: lcpX,
                y: lcpY,
              }}
            />
            <WebVitalLabel
              {...commonWebVitalLabelProps}
              webVital="fcp"
              coordinates={{
                x: fcpX,
                y: fcpY,
              }}
            />
            <WebVitalLabel
              {...commonWebVitalLabelProps}
              webVital="fid"
              coordinates={{
                x: fidX,
                y: fidY,
              }}
            />
            <WebVitalLabel
              {...commonWebVitalLabelProps}
              webVital="cls"
              coordinates={{
                x: clsX,
                y: clsY,
              }}
            />
            <WebVitalLabel
              {...commonWebVitalLabelProps}
              webVital="ttfb"
              coordinates={{
                x: ttfbX,
                y: ttfbY,
              }}
            />
          </Fragment>
        )}
        <PerformanceScoreRing
          values={[
            (projectScore.lcpScore ?? 0) * weights.lcp * 0.01,
            (projectScore.fcpScore ?? 0) * weights.fcp * 0.01,
            (projectScore.fidScore ?? 0) * weights.fid * 0.01,
            (projectScore.clsScore ?? 0) * weights.cls * 0.01,
            (projectScore.ttfbScore ?? 0) * weights.ttfb * 0.01,
          ]}
          maxValues={[weights.lcp, weights.fcp, weights.fid, weights.cls, weights.ttfb]}
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

function calculateLabelCoordinates(
  size: number,
  x: number,
  y: number,
  barWidth: number,
  weights: {
    [key in WebVitals]: number;
  },
  labelWidthPadding: number,
  labelHeightPadding: number,
  radiusPadding: number
) {
  const radius = size / 2 + barWidth + radiusPadding;
  const center = {
    x: x + size / 2 - labelWidthPadding / 2,
    y: y + size / 2 + labelHeightPadding / 2,
  };
  const sumMaxValues = Object.values(weights).reduce((acc, val) => acc + val, 0);
  const BASE_ANGLE = -90;
  const weightToAngle = (weight: number) => (weight / sumMaxValues) * 360;
  const [lcpAngle, fcpAngle, fidAngle, clsAngle, ttfbAngle] = [
    weights.lcp,
    weights.fcp,
    weights.fid,
    weights.cls,
    weights.ttfb,
  ].map(weightToAngle);
  const lcpX =
    center.x + radius * Math.cos(((BASE_ANGLE + lcpAngle / 2) * Math.PI) / 180);
  const lcpY =
    center.y + radius * Math.sin(((BASE_ANGLE + lcpAngle / 2) * Math.PI) / 180);
  const fcpX =
    center.x +
    radius * Math.cos(((BASE_ANGLE + lcpAngle + fcpAngle / 2) * Math.PI) / 180);
  const fcpY =
    center.y +
    radius * Math.sin(((BASE_ANGLE + lcpAngle + fcpAngle / 2) * Math.PI) / 180);
  const fidX =
    center.x +
    radius *
      Math.cos(((BASE_ANGLE + lcpAngle + fcpAngle + fidAngle / 2) * Math.PI) / 180);
  const fidY =
    center.y +
    radius *
      Math.sin(((BASE_ANGLE + lcpAngle + fcpAngle + fidAngle / 2) * Math.PI) / 180);
  const clsX =
    center.x +
    radius *
      Math.cos(
        ((BASE_ANGLE + lcpAngle + fcpAngle + fidAngle + clsAngle / 2) * Math.PI) / 180
      );
  const clsY =
    center.y +
    radius *
      Math.sin(
        ((BASE_ANGLE + lcpAngle + fcpAngle + fidAngle + clsAngle / 2) * Math.PI) / 180
      );
  // Padding hack for now since ttfb label is longer than the others
  const ttfbX =
    center.x -
    12 +
    radius *
      Math.cos(
        ((BASE_ANGLE + lcpAngle + fcpAngle + fidAngle + clsAngle + ttfbAngle / 2) *
          Math.PI) /
          180
      );
  const ttfbY =
    center.y +
    radius *
      Math.sin(
        ((BASE_ANGLE + lcpAngle + fcpAngle + fidAngle + clsAngle + ttfbAngle / 2) *
          Math.PI) /
          180
      );

  return {
    lcpX,
    lcpY,
    fcpX,
    fcpY,
    fidX,
    fidY,
    clsX,
    clsY,
    ttfbX,
    ttfbY,
  };
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
