import React from 'react';
import styled from '@emotion/styled';
import CircleIndicator from 'app/components/circleIndicator';
import theme from 'app/utils/theme';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {withTheme} from 'emotion-theming';

import {colors} from './constants';

type StatusProps = {
  status: string;
};

// const IntegrationStatus = (props: StatusProps) => {
//   const {status} = props;
//   // const color = status ? theme[colors[status]] : enabled ? theme.success : theme.gray2;
//   // const value = status ? status : enabled ? 'Installed' : 'Not Installed';
//   return <Status status={status} />;
// };

const StatusWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const IntegrationStatus = styled((props: StatusProps) => {
  const {status, ...p} = props;
  return (
    <StatusWrapper>
      <CircleIndicator size={6} color={theme[colors[status]]} />
      <div {...p}>{`${t(status)}`}</div>
    </StatusWrapper>
  );
})`
  color: ${(props: StatusProps) => theme[colors[props.status]]};
  margin-left: ${space(0.5)};
  font-weight: light;
  margin-right: ${space(0.75)};
`;

export default IntegrationStatus;
