import {Fragment} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import getDuration from 'sentry/utils/duration/getDuration';
import type {MobileVital, WebVital} from 'sentry/utils/fields';
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
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {isEAPTraceNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  TRACE_VIEW_MOBILE_VITALS,
  TRACE_VIEW_WEB_VITALS,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree.measurements';
import {useTraceContextSections} from 'sentry/views/performance/newTraceDetails/useTraceContextSections';

type Props = {
  containerWidth: number | undefined;
  rootEventResults: TraceRootEventQueryResults;
  tree: TraceTree;
};

export function TraceContextVitals({rootEventResults, tree, containerWidth}: Props) {
  const {hasVitals} = useTraceContextSections({tree, logs: undefined});
  const traceNode = tree.root.children[0];
  const theme = useTheme();

  // TODO Abdullah Khan: Ignoring loading/error states for now
  if (!hasVitals || !rootEventResults.data || !traceNode) {
    return null;
  }

  const vitalsToDisplay = tree.vital_types.has('web')
    ? TRACE_VIEW_WEB_VITALS
    : TRACE_VIEW_MOBILE_VITALS;

  const isEAPTrace = isEAPTraceNode(traceNode);
  const collectedVitals =
    isEAPTrace && tree.vital_types.has('mobile')
      ? getMobileVitalsFromRootEventResults(rootEventResults.data)
      : Array.from(tree.vitals.values()).flat();

  const primaryVitalsCount = getPrimaryVitalsCount(
    vitalsToDisplay,
    tree.vital_types.has('web') ? 'web' : 'mobile',
    containerWidth,
    theme
  );
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
              {`${vitalDetails.acronym ? vitalDetails.acronym : vitalDetails.name}`}:
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
    <VitalMetersContainer>
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
    </VitalMetersContainer>
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
          <SectionDivider />
          <div>
            {formattedMeterValueText} - {STATUS_TEXT[status]}
          </div>
        </Fragment>
      )}
    </div>
  );

  const acronym = vitalDetails.acronym ?? vitalDetails.name;
  return (
    <VitalPillContainer>
      <Tooltip title={toolTipTitle}>
        <VitalPillName status={status}>{`${acronym}`}</VitalPillName>
      </Tooltip>
      <VitalPillValue>{formattedMeterValueText}</VitalPillValue>
    </VitalPillContainer>
  );
}

const VitalPillContainer = styled('div')`
  display: flex;
  flex-direction: row;
  max-width: 'auto';
  height: 28px;
`;

const VitalPillName = styled('div')<{status: PerformanceScore}>`
  display: flex;
  align-items: center;
  position: relative;
  width: max-content;

  height: 100%;
  padding: 0 ${space(1)};
  border: solid 1px
    ${p =>
      p.status === 'none'
        ? p.theme.border
        : makePerformanceScoreColors(p.theme)[p.status].border};
  border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};

  background-color: ${p => makePerformanceScoreColors(p.theme)[p.status].light};
  color: ${p => makePerformanceScoreColors(p.theme)[p.status].normal};

  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: ${space(0.25)};
  text-decoration-thickness: 1px;

  cursor: pointer;
`;

const VitalPillValue = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;

  height: 100%;
  padding: 0 ${space(0.5)};
  border: 1px solid ${p => p.theme.border};
  border-left: none;
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;

  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};

  font-size: ${p => p.theme.fontSize.lg};
`;

const VitalMetersContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${space(1)};
  width: 'auto';
`;

const SecondaryVitalsCount = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;

const SecondaryVitalsCountContainer = styled('div')`
  display: flex;
  flex-direction: column;
  white-space: nowrap;
  gap: ${space(0.5)};
  text-align: left;
`;

function getPrimaryVitalsCount(
  primaryVitals: WebVital[] | MobileVital[],
  type: 'web' | 'mobile',
  containerWidth: number | undefined,
  theme: Theme
) {
  const totalCount = primaryVitals.length;

  if (!containerWidth) {
    return totalCount;
  }

  if (containerWidth > parseInt(theme.breakpoints['2xl'], 10)) {
    return totalCount;
  }

  if (containerWidth > parseInt(theme.breakpoints.sm, 10)) {
    if (type === 'web') {
      return totalCount;
    }

    return 3;
  }

  return 2;
}

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

function getMobileVitalsFromRootEventResults(
  data: TraceRootEventQueryResults['data']
): TraceTree.CollectedVital[] {
  if (!data || !isTraceItemDetailsResponse(data)) {
    return [];
  }

  return data.attributes
    .map(attribute => {
      if (
        TRACE_VIEW_MOBILE_VITALS.includes(attribute.name as MobileVital) &&
        typeof attribute.value === 'number'
      ) {
        return {
          key: attribute.name.replace('measurements.', ''),
          measurement: {value: attribute.value},
          score: undefined,
        };
      }
      return undefined;
    })
    .filter(defined);
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
