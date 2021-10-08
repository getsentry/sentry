import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import CircleIndicator from 'app/components/circleIndicator';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {IntegrationInstallationStatus} from 'app/types';

import {COLORS} from './constants';

type StatusProps = {
  status: IntegrationInstallationStatus;
};

const StatusWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const IntegrationStatus = styled(({status, ...p}: StatusProps) => {
  const theme = useTheme();

  return (
    <StatusWrapper>
      <CircleIndicator size={6} color={theme[COLORS[status]]} />
      <div {...p}>{`${t(status)}`}</div>
    </StatusWrapper>
  );
})`
  color: ${p => p.theme[COLORS[p.status]]};
  margin-left: ${space(0.5)};
  font-weight: light;
  margin-right: ${space(0.75)};
`;

export default IntegrationStatus;
