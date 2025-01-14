import styled from '@emotion/styled';

import {getTickStyle} from 'sentry/components/checkInTimeline/utils/getTickStyle';
import type {CheckInStatus} from 'sentry/views/monitors/types';

import {tickStyle} from '../utils';

const MonitorIndicator = styled('div')<{
  size: number;
  status: CheckInStatus;
}>`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  ${p => getTickStyle(tickStyle, p.status, p.theme)}
`;

export {MonitorIndicator};
