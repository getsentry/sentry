import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

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

  background-color: ${p => {
    switch (p.color) {
      case 'info':
        return p.theme.colors.blue400;
      case 'success':
        return p.theme.colors.green400;
      case 'muted':
        return p.theme.colors.gray200;
      case 'warning':
        return p.theme.colors.yellow400;
      case 'danger':
        return p.theme.colors.red400;
      default:
        return p.theme.colors.gray200;
    }
  }};
  & span {
    display: block;
    width: 9px;
    height: 15px;
  }
`;
