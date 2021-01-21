import React from 'react';
import styled from '@emotion/styled';

import {IconCheckmark, IconFire, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {formatPercentage} from 'app/utils/formatters';
import theme, {Color} from 'app/utils/theme';

import {VitalState, vitalStateColors} from './utils';

type Percent = {
  vitalState: VitalState;
  percent: number;
};

type Props = {
  percents: Percent[];
  showVitalPercentNames?: boolean;
};

export default function VitalPercents(props: Props) {
  return (
    <VitalSet>
      {props.percents.map(p => {
        return (
          <VitalStatus key={p.vitalState}>
            {p.vitalState === VitalState.POOR && (
              <IconFire color={vitalStateColors[p.vitalState] as Color} />
            )}
            {p.vitalState === VitalState.MEH && (
              <IconWarning color={vitalStateColors[p.vitalState] as Color} />
            )}
            {p.vitalState === VitalState.GOOD && (
              <IconCheckmark color={vitalStateColors[p.vitalState] as Color} isCircled />
            )}
            <span>
              {props.showVitalPercentNames && t(`${p.vitalState}`)}{' '}
              {formatPercentage(p.percent, 0)}
            </span>
          </VitalStatus>
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
