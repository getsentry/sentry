import {Fragment, useRef, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useMouseTracking from 'sentry/utils/useMouseTracking';
import useOrganization from 'sentry/utils/useOrganization';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import PerformanceScoreRing from 'sentry/views/insights/browser/webVitals/components/performanceScoreRing';
import type {
  ProjectScore,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';

import {getFormattedDuration} from './webVitalMeters';

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
  x?: number;
  y?: number;
};

type WebVitalLabelProps = {
  coordinates: Coordinates;
  inPerformanceWidget: boolean;
  location: Location;
  onHover: (webVital: WebVitals) => void;
  onUnHover: () => void;
  webVital: WebVitals;
  projectData?: TableData;
  webVitalLabelCoordinates?: WebVitalsLabelCoordinates;
};

function WebVitalLabel({
  location,
  webVital,
  coordinates,
  onHover,
  onUnHover,
  webVitalLabelCoordinates,
  inPerformanceWidget,
  projectData,
}: WebVitalLabelProps) {
  const moduleURL = useModuleURL('vital');
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
        pathname: moduleURL,
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

  const weights = organization.features.includes(
    'performance-vitals-handle-missing-webvitals'
  )
    ? getWeights(ORDER.filter(webVital => projectScore[`${webVital}Score`]))
    : PERFORMANCE_SCORE_WEIGHTS;

  const commonWebVitalLabelProps = {
    organization,
    location,
    inPerformanceWidget,
    webVitalLabelCoordinates,
    projectData,
    onHover: (webVital: WebVitals) => setLabelHovered(webVital),
    onUnHover: () => setLabelHovered(null),
  };

  const coordinates = calculateLabelCoordinates(
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
              <Dot
                color={ringBackgroundColors[ringSegmentOrder.indexOf(webVitalTooltip)]!}
              />
              {webVitalTooltip.toUpperCase()} {t('Opportunity')}
            </span>
            <TooltipValue>
              {100 - (projectScore[`${webVitalTooltip}Score`] ?? 0)}
            </TooltipValue>
          </TooltipRow>
          <TooltipRow>
            <span>
              <Dot
                color={ringSegmentColors[ringSegmentOrder.indexOf(webVitalTooltip)]!}
              />
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
            {Object.keys(weights).map((key, index) => {
              const webVital = key as WebVitals;
              if (weights[key] > 0 && coordinates[webVital] !== undefined) {
                return (
                  <WebVitalLabel
                    {...commonWebVitalLabelProps}
                    key={`webVitalLabel-${key}-${index}`}
                    webVital={webVital}
                    coordinates={coordinates[webVital] as Coordinates}
                  />
                );
              }
              return null;
            })}
          </Fragment>
        )}
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
  const angles = Object.values(weights).map(weightToAngle);
  const coordinates = angles.map((angle, index) => {
    const previousAngles = angles.slice(0, index).reduce((acc, value) => acc + value, 0);
    const segmentX =
      center.x +
      radius * Math.cos(((BASE_ANGLE + previousAngles + angle / 2) * Math.PI) / 180);
    const segmentY =
      center.y +
      radius * Math.sin(((BASE_ANGLE + previousAngles + angle / 2) * Math.PI) / 180);
    return {x: segmentX, y: segmentY};
  });

  const results: {[key in WebVitals]?: {x: number; y: number}} = {};
  Object.keys(weights).forEach((key, index) => {
    results[key] = {
      // Padding hack for now since ttfb label is longer than the others
      x: coordinates[index]!.x + (key === 'ttfb' ? -12 : 0),
      y: coordinates[index]!.y,
    };
  });
  return results;
}

const ProgressRingContainer = styled('div')``;

const ProgressRingText = styled('text')<{isLink?: boolean}>`
  font-size: ${p => p.theme.fontSizeMedium};
  fill: ${p => (p.isLink ? p.theme.blue300 : p.theme.textColor)};
  font-weight: ${p => p.theme.fontWeightBold};
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
