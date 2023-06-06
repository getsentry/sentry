import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';

type Props = {
  status: 'muted' | 'info' | 'warning' | 'success' | 'resolved' | 'error';
  tooltipTitle: React.ReactNode;
};

/**
 * A badge/indicator at the beginning of the row that displays
 * the color of the status level (Warning, Error, Success, etc)
 *
 */
function StatusIndicator({status, tooltipTitle}: Props) {
  let color: keyof Theme['alert'] = 'error';

  if (status === 'muted') {
    color = 'muted';
  } else if (status === 'info') {
    color = 'info';
  } else if (status === 'warning') {
    color = 'warning';
  } else if (status === 'success' || status === 'resolved') {
    color = 'success';
  }

  return (
    <Tooltip title={tooltipTitle} skipWrapper>
      <StatusLevel color={color} />
    </Tooltip>
  );
}

export default StatusIndicator;

const StatusLevel = styled('div')<{color: keyof Theme['alert']}>`
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
