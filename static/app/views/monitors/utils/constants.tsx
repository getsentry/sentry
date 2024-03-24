import type {StatusIndicatorProps} from 'sentry/components/statusIndicator';
import {IconCheckmark, IconFire, IconTimer, IconUnsubscribed} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {StatsBucket} from 'sentry/views/monitors/components/overviewTimeline/types';
import type {MonitorStatus, StatusNotice} from 'sentry/views/monitors/types';
import {CheckInStatus} from 'sentry/views/monitors/types';

// Orders the status in terms of ascending precedence for showing to the user
export const CHECKIN_STATUS_PRECEDENT = [
  CheckInStatus.IN_PROGRESS,
  CheckInStatus.OK,
  CheckInStatus.MISSED,
  CheckInStatus.TIMEOUT,
  CheckInStatus.ERROR,
] satisfies Array<keyof StatsBucket>;

export const statusIconColorMap: Record<MonitorStatus, StatusNotice> = {
  ok: {
    icon: <IconCheckmark color="successText" />,
    color: 'successText',
  },
  error: {
    icon: <IconFire color="errorText" />,
    color: 'errorText',
  },
  active: {
    icon: <IconTimer color="subText" />,
    color: 'subText',
    label: t('Waiting For Check-In'),
  },
  disabled: {
    icon: <IconUnsubscribed color="subText" size="xs" />,
    color: 'subText',
    label: t('Muted'),
  },
};

export const checkStatusToIndicatorStatus: Record<
  CheckInStatus,
  StatusIndicatorProps['status']
> = {
  [CheckInStatus.OK]: 'success',
  [CheckInStatus.ERROR]: 'error',
  [CheckInStatus.IN_PROGRESS]: 'muted',
  [CheckInStatus.MISSED]: 'warning',
  [CheckInStatus.TIMEOUT]: 'error',
};
