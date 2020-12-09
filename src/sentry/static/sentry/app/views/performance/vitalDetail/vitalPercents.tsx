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
    <Container>
      {props.percents.map(p => {
        return (
          <Vital key={p.vitalState}>
            {p.vitalState === VitalState.POOR && (
              <IconFire color={vitalStateColors[p.vitalState] as Color} />
            )}
            {p.vitalState === VitalState.MEH && (
              <IconWarning color={vitalStateColors[p.vitalState] as Color} />
            )}
            {p.vitalState === VitalState.GOOD && (
              <IconCheckmark color={vitalStateColors[p.vitalState] as Color} isCircled />
            )}
            <Percent>
              {props.showVitalPercentNames && t(`${p.vitalState}`)}{' '}
              {formatPercentage(p.percent, 0)}
            </Percent>
          </Vital>
        );
      })}
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  gap: ${space(2)};
  margin-top: ${space(2)};
`;

const Vital = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${theme.fontSizeMedium};
`;

const Percent = styled('div')`
  margin-left: ${space(0.5)};
`;
