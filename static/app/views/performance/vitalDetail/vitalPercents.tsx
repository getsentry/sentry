import styled from '@emotion/styled';

import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {WebVital} from 'sentry/utils/fields';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

import {VitalState, vitalStateIcons, webVitalMeh, webVitalPoor} from './utils';

type Percent = {
  percent: number;
  vitalState: VitalState;
};

type Props = {
  percents: Percent[];
  vital: WebVital | WebVital[];
  hideTooltips?: boolean;
  showVitalPercentNames?: boolean;
  showVitalThresholds?: boolean;
};

function getVitalStateText(vital: WebVital | WebVital[], vitalState: any) {
  const unit = !Array.isArray(vital) && vital !== WebVital.CLS ? 'ms' : '';
  switch (vitalState) {
    case VitalState.POOR:
      return Array.isArray(vital)
        ? t('Poor')
        : // @ts-ignore TS(2551): Property 'measurements.ttfb' does not exist on typ... Remove this comment to see the full error message
          tct('(>[threshold][unit])', {threshold: webVitalPoor[vital], unit});
    case VitalState.MEH:
      return Array.isArray(vital)
        ? t('Meh')
        : // @ts-ignore TS(2551): Property 'measurements.ttfb' does not exist on typ... Remove this comment to see the full error message
          tct('(>[threshold][unit])', {threshold: webVitalMeh[vital], unit});
    case VitalState.GOOD:
      return Array.isArray(vital)
        ? t('Good')
        : // @ts-ignore TS(2551): Property 'measurements.ttfb' does not exist on typ... Remove this comment to see the full error message
          tct('(<=[threshold][unit])', {threshold: webVitalMeh[vital], unit});
    default:
      return null;
  }
}

export default function VitalPercents(props: Props) {
  return (
    <VitalSet>
      {props.percents.map(pct => (
        <VitalStatus data-test-id="vital-status" key={pct.vitalState}>
          {vitalStateIcons[pct.vitalState]}
          {props.showVitalPercentNames && pct.vitalState}{' '}
          {formatPercentage(pct.percent, 0)}
          {props.showVitalThresholds && getVitalStateText(props.vital, pct.vitalState)}
        </VitalStatus>
      ))}
    </VitalSet>
  );
}

const VitalSet = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(2)};
`;

const VitalStatus = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
`;
