import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {IconCheckmark, IconFire, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {WebVital} from 'app/utils/discover/fields';
import {formatPercentage} from 'app/utils/formatters';
import theme, {Color} from 'app/utils/theme';

import {VitalState, vitalStateColors, webVitalMeh, webVitalPoor} from './utils';

type Percent = {
  vitalState: VitalState;
  percent: number;
};

type Props = {
  vital: WebVital | WebVital[];
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
              <Tooltip
                title={
                  Array.isArray(props.vital)
                    ? t('Poor')
                    : tct('Poor: >[threshold]ms', {
                        threshold: webVitalPoor[props.vital],
                      })
                }
              >
                <IconFire
                  style={{verticalAlign: 'middle'}}
                  color={vitalStateColors[p.vitalState] as Color}
                />
              </Tooltip>
            )}
            {p.vitalState === VitalState.MEH && (
              <Tooltip
                title={
                  Array.isArray(props.vital)
                    ? t('Needs improvement')
                    : tct('Needs improvement: >[threshold]ms', {
                        threshold: webVitalMeh[props.vital],
                      })
                }
              >
                <IconWarning
                  style={{verticalAlign: 'middle'}}
                  color={vitalStateColors[p.vitalState] as Color}
                />
              </Tooltip>
            )}
            {p.vitalState === VitalState.GOOD && (
              <Tooltip
                title={
                  Array.isArray(props.vital)
                    ? t('Good')
                    : tct('Good: <[threshold]ms', {
                        threshold: webVitalMeh[props.vital],
                      })
                }
              >
                <IconCheckmark
                  style={{verticalAlign: 'middle'}}
                  color={vitalStateColors[p.vitalState] as Color}
                  isCircled
                />
              </Tooltip>
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
