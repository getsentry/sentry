import React from 'react';
import styled from '@emotion/styled';
import CircleIndicator from 'app/components/circleIndicator';
import theme from 'app/utils/theme';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {withTheme} from 'emotion-theming';

import {colors} from './constants';

type Props = {
  status?: string;
  enabled?: boolean;
  theme?: any;
};

type StatusProps = {theme?: any; color: string; value: string};

const IntegrationStatus = (props: Props) => {
  const {status, enabled} = props;
  const color = status ? theme[colors[status]] : enabled ? theme.success : theme.gray2;
  const value = status ? status : enabled ? 'Installed' : 'Not Installed';
  return <Status color={color} value={value} />;
};

const StatusWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const Status = styled(
  withTheme((props: StatusProps) => {
    const {color, value, ...p} = props;
    return (
      <StatusWrapper>
        <CircleIndicator size={6} color={color} />
        <div {...p}>{`${t(value)}`}</div>
      </StatusWrapper>
    );
  })
)`
  color: ${(props: StatusProps) => props.color};
  margin-left: ${space(0.5)};
  font-weight: light;
  margin-right: ${space(0.75)};
`;

export default IntegrationStatus;
