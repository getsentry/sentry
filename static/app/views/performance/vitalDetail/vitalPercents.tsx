import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {WebVital} from 'app/utils/discover/fields';
import {formatPercentage} from 'app/utils/formatters';

import {VitalState, vitalStateIcons, webVitalMeh, webVitalPoor} from './utils';

type Percent = {
  vitalState: VitalState;
  percent: number;
};

type Props = {
  vital: WebVital | WebVital[];
  percents: Percent[];
  showVitalPercentNames?: boolean;
};

function getVitalStateText(vital: WebVital | WebVital[], vitalState) {
  const unit = !Array.isArray(vital) && vital !== WebVital.CLS ? 'ms' : '';
  switch (vitalState) {
    case VitalState.POOR:
      return Array.isArray(vital)
        ? t('Poor')
        : tct('Poor: >[threshold][unit]', {threshold: webVitalPoor[vital], unit});
    case VitalState.MEH:
      return Array.isArray(vital)
        ? t('Meh')
        : tct('Meh: >[threshold][unit]', {threshold: webVitalMeh[vital], unit});
    case VitalState.GOOD:
      return Array.isArray(vital)
        ? t('Good')
        : tct('Good: <[threshold][unit]', {threshold: webVitalMeh[vital], unit});
    default:
      return null;
  }
}

export default function VitalPercents(props: Props) {
  return (
    <VitalSet>
      {props.percents.map(pct => {
        return (
          <Tooltip
            key={pct.vitalState}
            title={getVitalStateText(props.vital, pct.vitalState)}
          >
            <VitalStatus>
              {vitalStateIcons[pct.vitalState]}
              <span>
                {props.showVitalPercentNames && t(`${pct.vitalState}`)}{' '}
                {formatPercentage(pct.percent, 0)}
              </span>
            </VitalStatus>
          </Tooltip>
        );
      })}
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
