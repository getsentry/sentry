import styled from '@emotion/styled';

import {getTickStyle} from 'sentry/components/checkInTimeline/utils/getTickStyle';
import type {CheckStatus} from 'sentry/views/alerts/rules/uptime/types';
import {tickStyle} from 'sentry/views/insights/uptime/timelineConfig';

export const CheckIndicator = styled('div')<{status: CheckStatus; width?: number}>`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  height: ${p => p.width ?? 12}px;
  width: ${p => p.width ?? 12}px;
  ${p => getTickStyle(tickStyle, p.status, p.theme)}
`;
