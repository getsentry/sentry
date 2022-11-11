import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';

import {Status} from './types';

interface Props {
  size: number;
  status: Status;
}

const statusToMessage = {
  ok: t('Ok'),
  error: t('Failed'),
  disabled: t('Disabled'),
  active: t('Active'),
  missed_checkin: t('Missed Checkin'),
};

const MonitorIcon = ({size, status}: Props) => (
  <Tooltip
    title={tct('Monitor Status: [statusMessage]', {
      statusMessage: statusToMessage[status],
    })}
  >
    <MonitorBubble size={size} status={status} />
  </Tooltip>
);

export default MonitorIcon;

const MonitorBubble = styled('div')<{size: number; status: Status}>`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  height: ${p => p.size}px;
  width: ${p => p.size}px;

  ${p =>
    p.color
      ? `background: ${p.color};`
      : `background: ${
          p.status === 'error'
            ? p.theme.error
            : p.status === 'ok'
            ? p.theme.success
            : p.status === 'missed_checkin'
            ? p.theme.yellow300
            : p.theme.disabled
        };`};
`;
