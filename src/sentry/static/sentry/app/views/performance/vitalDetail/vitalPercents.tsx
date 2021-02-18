import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {WebVital} from 'app/utils/discover/fields';
import {formatPercentage} from 'app/utils/formatters';
import theme from 'app/utils/theme';

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

function vitalStateText(vital, vitalState) {
  switch (vitalState) {
    case VitalState.POOR:
      return Array.isArray(vital)
        ? t('Poor')
        : tct('Poor: >[threshold]ms', webVitalPoor[vital]);
    case VitalState.MEH:
      return Array.isArray(vital)
        ? t('Needs improvement')
        : tct('Needs improvement: >[threshold]ms', webVitalMeh[vital]);
    case VitalState.GOOD:
      return Array.isArray(vital)
        ? t('Good')
        : tct('Good: <[threshold]ms', webVitalMeh[vital]);
    default:
      return null;
  }
}

export default function VitalPercents(props: Props) {
  return (
    <VitalSet>
      {props.percents.map(p => {
        return (
          <Tooltip key={p.vitalState} title={vitalStateText(props.vital, p.vitalState)}>
            <VitalStatus>
              ${vitalStateIcons[p.vitalState]}
              <span>
                {props.showVitalPercentNames && t(`${p.vitalState}`)}{' '}
                {formatPercentage(p.percent, 0)}
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
  font-size: ${theme.fontSizeMedium};
`;
