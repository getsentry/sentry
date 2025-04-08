import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import type {Vital} from 'sentry/utils/performance/vitals/types';
import {VITAL_DESCRIPTIONS} from 'sentry/views/insights/browser/webVitals/components/webVitalDescription';
import {WEB_VITALS_METERS_CONFIG} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {PERFORMANCE_SCORE_COLORS} from 'sentry/views/insights/browser/webVitals/utils/performanceScoreColors';
import {
  scoreToStatus,
  STATUS_TEXT,
} from 'sentry/views/insights/browser/webVitals/utils/scoreToStatus';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

type Props = {
  tree: TraceTree;
};

export function treeHasValidVitals(tree: TraceTree) {
  const allowedVitals = Object.keys(VITAL_DETAILS);
  return Array.from(tree.vitals.values()).some(vitalGroup =>
    vitalGroup.some(vital => allowedVitals.includes(`measurements.${vital.key}`))
  );
}

export function TraceContextVitals({tree}: Props) {
  const hasValidVitals = treeHasValidVitals(tree);

  if (!hasValidVitals) {
    return null;
  }

  const allVitals = Array.from(tree.vitals.values()).flat();
  return allVitals.map(vital => {
    const vitalDetails =
      VITAL_DETAILS[`measurements.${vital.key}` as keyof typeof VITAL_DETAILS];
    return (
      <VitalPill
        key={vital?.key}
        vital={vitalDetails}
        score={vital?.score}
        meterValue={vital?.measurement.value}
      />
    );
  });
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

type VitalPillProps = {
  meterValue: number | undefined;
  score: number | undefined;
  vital: Vital;
};

export function VitalPill({vital, score, meterValue}: VitalPillProps) {
  const status = score === undefined || isNaN(score) ? 'none' : scoreToStatus(score);
  const webVitalsConfig = WEB_VITALS_METERS_CONFIG;

  const formattedMeterValueText = meterValue ? (
    vital.slug in webVitalsConfig ? (
      webVitalsConfig[vital.slug as WebVitals].formatter(meterValue)
    ) : (
      defaultVitalValueFormatter(vital, meterValue)
    )
  ) : (
    <NoValue />
  );

  const tooltipText =
    `measurements.${vital.slug}` in VITAL_DESCRIPTIONS
      ? VITAL_DESCRIPTIONS[
          `measurements.${vital.slug}` as keyof typeof VITAL_DESCRIPTIONS
        ]!.shortDescription
      : vital.description;

  return (
    <VitalPillContainer>
      <Tooltip title={tooltipText}>
        <VitalPillName status={status}>
          {`${vital.acronym ? vital.acronym : vital.name}${status === 'none' ? '' : ` (${STATUS_TEXT[status]})`}`}
        </VitalPillName>
      </Tooltip>
      <VitalPillValue>{formattedMeterValueText}</VitalPillValue>
    </VitalPillContainer>
  );
}

const VitalPillContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-grow: 1;
  max-width: 20%;
  height: 30px;
  margin-bottom: ${space(1)};
`;

const VitalPillName = styled('div')<{status: keyof typeof PERFORMANCE_SCORE_COLORS}>`
  display: flex;
  align-items: center;
  position: relative;
  width: max-content;

  height: 100%;
  padding: 0 ${space(1)};
  border: solid 1px ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].border]};
  border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};

  background-color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].light]};
  color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
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
  border: 1px solid ${p => p.theme.gray200};
  border-left: none;
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;

  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};

  font-size: ${p => p.theme.fontSizeLarge};
`;

const NoValueContainer = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.headerFontSize};
`;

function NoValue() {
  return <NoValueContainer>{' \u2014 '}</NoValueContainer>;
}
