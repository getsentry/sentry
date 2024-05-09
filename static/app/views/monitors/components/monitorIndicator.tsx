import styled from '@emotion/styled';

import type {CheckInStatus} from 'sentry/views/monitors/types';
import {getTickStyle} from 'sentry/views/monitors/utils';

const MonitorIndicator = styled('div')<{
  size: number;
  status: CheckInStatus;
}>`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  ${p => getTickStyle(p.status, p.theme)}
`;

export {MonitorIndicator};
