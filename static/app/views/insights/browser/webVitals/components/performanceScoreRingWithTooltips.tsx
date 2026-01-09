import {Fragment, useRef, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Flex} from '@sentry/scraps/layout';

import {Link} from 'sentry/components/core/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';

import {getFormattedDuration} from './webVitalMeters';

type Coordinates = {
  x: number;
  y: number;
};

type WebVitalsLabelCoordinates = Partial<Record<WebVitals, Coordinates>>;

type ProjectData = {
  'p75(measurements.cls)': number;
  'p75(measurements.fcp)': number;
  'p75(measurements.inp)': number;
  'p75(measurements.lcp)': number;
  'p75(measurements.ttfb)': number;
};

type Props = {
  height: number;
  projectScore: ProjectScore;
  ringBackgroundColors: readonly string[];
  ringSegmentColors: readonly string[];
  text: React.ReactNode;
  width: number;
  barWidth?: number;
  differenceToPreviousPeriod?: ProjectScore;
  hideWebVitalLabels?: boolean;
  inPerformanceWidget?: boolean;
  labelHeightPadding?: number;
  projectData?: ProjectData[];
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
  differenceToPreviousPeriod?: ProjectScore;
  projectData?: ProjectData[];
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
  differenceToPreviousPeriod,
}: WebVitalLabelProps) {
  const moduleURL = useModuleURL('vital');
  const xOffset = webVitalLabelCoordinates?.[webVital]?.x ?? 0;
  const yOffset = webVitalLabelCoordinates?.[webVital]?.y ?? 0;
  const webvitalInfo =
    webVital === 'cls'
      ? Math.round((projectData?.[0]?.['p75(measurements.cls)'] as number) * 100) / 100
      : getFormattedDuration(
          (projectData?.[0]?.[`p75(measurements.${webVital})`] as number) / 1000
        );

  const diffValue = differenceToPreviousPeriod?.[`${webVital}Score`];

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
        <ProgressRingSubText x={coordinates.x + xOffset} y={coordinates.y + yOffset + 15}>
          {webvitalInfo}
        </ProgressRingSubText>
      )}
      {inPerformanceWidget && diffValue !== undefined && (
        <ProgressRingDiffSubText
          value={diffValue}
          x={coordinates.x + xOffset}
          y={coordinates.y + yOffset + 30}
        >
          {diffValue > 0
            ? `+${diffValue.toFixed(1)}%`
            : diffValue < 0
              ? `${diffValue.toFixed(1)}%`
              : '-'}
        </ProgressRingDiffSubText>
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
  differenceToPreviousPeriod,
  webVitalLabelCoordinates,
  barWidth = 16,
  hideWebVitalLabels = false,
  inPerformanceWidget = false,
  size = 140,
  x = 40,
  y = 25,
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
      return i === index ? color : theme.colors.gray200;
    });
    ringBackgroundColors = ringBackgroundColors.map((color, i) => {
      return i === index ? color : `${theme.colors.gray200}33`;
    });
  }

  const weights = getWeights(ORDER.filter(webVital => projectScore[`${webVital}Score`]));

  const commonWebVitalLabelProps = {
    organization,
    location,
    inPerformanceWidget,
    webVitalLabelCoordinates,
    projectData,
    onHover: (webVital: WebVitals) => setLabelHovered(webVital),
    onUnHover: () => setLabelHovered(null),
    differenceToPreviousPeriod,
  };

  const coordinates = calculateLabelCoordinates(
    size,
    x,
    y,
    barWidth,
    weights,
    labelHeightPadding,
    radiusPadding
  );

  return (
    <ProgressRingContainer ref={elem} {...mouseTrackingProps}>
      {webVitalTooltip && (
        <PerformanceScoreRingTooltip x={mousePosition.x} y={mousePosition.y}>
          <Flex justify="between" align="center">
            <span>
              <Dot
                color={ringBackgroundColors[ringSegmentOrder.indexOf(webVitalTooltip)]!}
              />
              {webVitalTooltip.toUpperCase()} {t('Opportunity')}
            </span>
            <TooltipValue>
              {100 - (projectScore[`${webVitalTooltip}Score`] ?? 0)}
            </TooltipValue>
          </Flex>
          <Flex justify="between" align="center">
            <span>
              <Dot
                color={ringSegmentColors[ringSegmentOrder.indexOf(webVitalTooltip)]!}
              />
              {webVitalTooltip.toUpperCase()} {t('Score')}
            </span>
            <TooltipValue>{projectScore[`${webVitalTooltip}Score`]}</TooltipValue>
          </Flex>
          <PerformanceScoreRingTooltipArrow />
        </PerformanceScoreRingTooltip>
      )}
      <svg height={height} width={width}>
        {!hideWebVitalLabels && (
          <Fragment>
            {Object.keys(weights).map((key, index) => {
              const webVital = key as WebVitals;
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
            font-weight: ${theme.fontWeight.bold};
            color: ${theme.tokens.content.primary};
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
  weights: Record<WebVitals, number>,
  labelHeightPadding: number,
  radiusPadding: number
) {
  const radius = size / 2 + barWidth + radiusPadding;
  const center = {
    x: x + size / 2,
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

  const results: Partial<Record<WebVitals, {x: number; y: number}>> = {};
  Object.keys(weights).forEach((key, index) => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    results[key] = {
      x: coordinates[index]!.x,
      y: coordinates[index]!.y,
    };
  });
  return results;
}

const ProgressRingContainer = styled('div')``;

const ProgressRingText = styled('text')<{isLink?: boolean}>`
  font-size: ${p => p.theme.fontSize.md};
  fill: ${p => (p.isLink ? p.theme.colors.blue400 : p.theme.tokens.content.primary)};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-transform: uppercase;
  text-anchor: middle;
`;

const ProgressRingSubText = styled('text')`
  font-size: ${p => p.theme.fontSize.sm};
  fill: ${p => p.theme.subText};
  text-anchor: middle;
`;

const ProgressRingDiffSubText = styled(ProgressRingSubText)<{value: number}>`
  fill: ${p =>
    p.value < 0
      ? p.theme.colors.green400
      : p.value > 0
        ? p.theme.colors.red400
        : p.theme.subText};
`;

// Hover element on mouse
const PerformanceScoreRingTooltip = styled('div')<{x: number; y: number}>`
  position: absolute;
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
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
  border-top: 8px solid ${p => p.theme.tokens.background.primary};
  margin-left: -8px;
  &:before {
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
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

const TooltipValue = styled('span')`
  color: ${p => p.theme.subText};
`;

export default PerformanceScoreRingWithTooltips;
