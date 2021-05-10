import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import CircleIndicator from 'app/components/circleIndicator';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {IntegrationInstallationStatus} from 'app/types';
import {Theme} from 'app/utils/theme';

import {COLORS} from './constants';

type StatusProps = {
  theme: Theme;
  status: IntegrationInstallationStatus;
};

const StatusWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const IntegrationStatus = styled(
  withTheme((props: StatusProps) => {
    const {theme, status, ...p} = props;
    return (
      <StatusWrapper>
        <CircleIndicator size={6} color={theme[COLORS[status]]} />
        <div {...p}>{`${t(status)}`}</div>
      </StatusWrapper>
    );
  })
)`
  color: ${p => p.theme[COLORS[p.status]]};
  margin-left: ${space(0.5)};
  font-weight: light;
  margin-right: ${space(0.75)};
`;

export default IntegrationStatus;
