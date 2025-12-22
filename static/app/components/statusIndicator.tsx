import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import type {AlertVariant} from 'sentry/utils/theme';

type StatusVariant = AlertVariant | 'resolved';
export interface StatusIndicatorProps {
  status: StatusVariant;
  tooltipTitle: React.ReactNode;
}

/**
 * A badge/indicator at the beginning of the row that displays
 * the color of the status level (Warning, Error, Success, etc)
 *
 */
export function StatusIndicator({status, tooltipTitle}: StatusIndicatorProps) {
  const color: AlertVariant = status === 'resolved' ? 'success' : status;

  return (
    <Tooltip title={tooltipTitle} skipWrapper>
      <StatusLevel color={color} />
    </Tooltip>
  );
}

const StatusLevel = styled('div')<{color: AlertVariant}>`
  position: absolute;
  left: -1px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => p.theme.alert[p.color].background};
  & span {
    display: block;
    width: 9px;
    height: 15px;
  }
`;
