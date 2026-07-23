import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex, type Responsive, useResponsivePropValue} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {MobileVital, type WebVital} from 'sentry/utils/fields';
import {VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import type {Vital, Vital as VitalDetails} from 'sentry/utils/performance/vitals/types';
import {VITAL_DESCRIPTIONS} from 'sentry/views/insights/browser/webVitals/components/webVitalDescription';
import {WEB_VITALS_METERS_CONFIG} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {
  makePerformanceScoreColors,
  type PerformanceScore,
} from 'sentry/views/insights/browser/webVitals/utils/performanceScoreColors';
import {
  scoreToStatus,
  STATUS_TEXT,
} from 'sentry/views/insights/browser/webVitals/utils/scoreToStatus';
import {SectionDivider} from 'sentry/views/issueDetails/foldSection';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  TRACE_VIEW_MOBILE_VITALS,
  TRACE_VIEW_WEB_VITALS,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree.measurements';
import {useTraceContextSections} from 'sentry/views/performance/newTraceDetails/useTraceContextSections';

type Props = {
  rootEventResults: TraceRootEventQueryResults;
  tree: TraceTree;
};

export function TraceContextVitals({rootEventResults, tree}: Props) {
  const {hasVitals} = useTraceContextSections({
    tree,
    logs: undefined,
    metrics: undefined,
  });
  const traceNode = tree.root.children[0];

  const isWeb = tree.vital_types.has('web');
  const vitalsToDisplay = isWeb ? TRACE_VIEW_WEB_VITALS : TRACE_VIEW_MOBILE_VITALS;
  const totalCount = vitalsToDisplay.length;

  // How many vitals fit inline before collapsing into "+N more", resolved
  // against the container width. Web shows all from xl up; mobile ramps 2 → 3
  // and stays at 3 — showing all 7 mobile vitals inline crowds/overflows the row.
  const primaryCountByBreakpoint: Responsive<number> = isWeb
    ? {zero: 2, xl: totalCount}
    : {zero: 2, xl: 3};
  const resolvedCount = useResponsivePropValue(primaryCountByBreakpoint);
  const primaryVitalsCount =
    typeof resolvedCount === 'number' ? resolvedCount : totalCount;

  // TODO Abdullah Khan: Ignoring loading/error states for now
  if (!hasVitals || !rootEventResults.data || !traceNode) {
    return null;
  }

  const collectedVitals = Array.from(tree.vitals.values()).flat();

  const [primaryVitals, secondaryVitals] = [
    vitalsToDisplay.slice(0, primaryVitalsCount),
    vitalsToDisplay.slice(primaryVitalsCount),
  ];

  const tooltipTitle = (
    <SecondaryVitalsCountContainer>
      {secondaryVitals.map(vitalKey => {
        const {vitalDetails, vital} = getVitalInfo(vitalKey, collectedVitals);
        const formattedValue = getFormattedValue(vital, vitalDetails);

        return (
          <div key={vitalKey}>
            <strong>
              {vitalDetails.acronym ? vitalDetails.acronym : vitalDetails.name}:
            </strong>{' '}
            <span>{formattedValue}</span>
            {vital?.score !== undefined &&
              ` (${STATUS_TEXT[scoreToStatus(vital.score)]})`}
          </div>
        );
      })}
    </SecondaryVitalsCountContainer>
  );

  return (
    <Flex align="center" gap="md">
      {primaryVitals.map(vitalKey => {
        const {vitalDetails, vital} = getVitalInfo(vitalKey, collectedVitals);
        return <VitalPill key={vitalKey} vitalDetails={vitalDetails} vital={vital} />;
      })}
      {secondaryVitals.length > 0 && (
        <Tooltip showUnderline title={tooltipTitle}>
          <SecondaryVitalsCount>
            +{secondaryVitals.length} {t('more')}
          </SecondaryVitalsCount>
        </Tooltip>
      )}
    </Flex>
  );
}

type VitalPillProps = {
  vital: TraceTree.CollectedVital | undefined;
  vitalDetails: VitalDetails;
};

function VitalPill({vital, vitalDetails}: VitalPillProps) {
  const status = vital?.score === undefined ? 'none' : scoreToStatus(vital.score);

  const formattedMeterValueText = getFormattedValue(vital, vitalDetails);

  const description =
    `measurements.${vitalDetails.slug}` in VITAL_DESCRIPTIONS
      ? VITAL_DESCRIPTIONS[
          `measurements.${vitalDetails.slug}` as keyof typeof VITAL_DESCRIPTIONS
        ]!.shortDescription
      : vitalDetails.description;

  const toolTipTitle = (
    <div>
      <div>{description}</div>
      {status === 'none' ? null : (
        <Fragment>
          <SectionDivider orientation="horizontal" />
          <div>
            {formattedMeterValueText} - {STATUS_TEXT[status]}
          </div>
        </Fragment>
      )}
    </div>
  );

  const acronym = vitalDetails.acronym ?? vitalDetails.name;
  return (
    <Flex>
      <VitalPillName status={status}>
        <Tooltip title={toolTipTitle}>{acronym}</Tooltip>
      </VitalPillName>
      <VitalPillValue>{formattedMeterValueText}</VitalPillValue>
    </Flex>
  );
}

const VitalPillName = styled('div')<{status: PerformanceScore}>`
  display: flex;
  align-items: center;
  justify-content: center;
  border: solid 1px
    ${p =>
      p.status === 'none'
        ? p.theme.tokens.border.primary
        : makePerformanceScoreColors(p.theme)[p.status].border};
  border-radius: ${p => p.theme.radius.md} 0 0 ${p => p.theme.radius.md};
  background-color: ${p => makePerformanceScoreColors(p.theme)[p.status].light};
  color: ${p => makePerformanceScoreColors(p.theme)[p.status].normal};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: ${p => p.theme.space['2xs']};
  text-decoration-thickness: 1px;
  padding: 0 ${p => p.theme.space.md};
`;

const VitalPillValue = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-left: none;
  background: ${p => p.theme.tokens.background.primary};
  border-radius: 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.lg};
  padding: 0 ${p => p.theme.space.md};
`;

const SecondaryVitalsCount = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;

const SecondaryVitalsCountContainer = styled('div')`
  display: flex;
  flex-direction: column;
  white-space: nowrap;
  gap: ${p => p.theme.space.xs};
  text-align: left;
`;

const getVitalInfo = (
  vitalKey: WebVital | MobileVital,
  collectedVitals: TraceTree.CollectedVital[]
) => {
  const vitalDetails = getVitalDetails(vitalKey);
  const vital = collectedVitals.find(
    v => v.key === vitalKey.replace('measurements.', '')
  );
  return {vitalDetails, vital};
};

function getVitalDetails(vitalKey: WebVital | MobileVital): VitalDetails {
  return VITAL_DETAILS[vitalKey];
}

function getFormattedValue(
  vital: TraceTree.CollectedVital | undefined,
  vitalDetails: VitalDetails
): string | number {
  return vital?.measurement.value
    ? vitalDetails.slug in WEB_VITALS_METERS_CONFIG
      ? WEB_VITALS_METERS_CONFIG[vitalDetails.slug as WebVitals].formatter(
          vital.measurement.value
        )
      : defaultVitalValueFormatter(vitalDetails, vital.measurement.value)
    : '\u2014';
}

function defaultVitalValueFormatter(vital: Vital, value: number) {
  if (vital?.type === 'duration') {
    return getDuration(value / 1000, 2, true);
  }

  if (vital?.type === 'integer') {
    return value.toFixed(0);
  }

  return value.toFixed(2);
}
