import {
  IconCheckmark,
  IconFire,
  IconTimer,
  IconUnsubscribed,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Aliases} from 'sentry/utils/theme';
import {StatsBucket} from 'sentry/views/monitors/components/overviewTimeline/types';
import {CheckInStatus, MonitorStatus} from 'sentry/views/monitors/types';

// Orders the status in terms of ascending precedence for showing to the user
export const CHECKIN_STATUS_PRECEDENT = [
  CheckInStatus.IN_PROGRESS,
  CheckInStatus.OK,
  CheckInStatus.MISSED,
  CheckInStatus.TIMEOUT,
  CheckInStatus.ERROR,
] satisfies Array<keyof StatsBucket>;

export const statusIconColorMap: Record<
  MonitorStatus,
  {color: keyof Aliases; icon: React.ReactNode; label: string}
> = {
  ok: {
    icon: <IconCheckmark color="successText" />,
    color: 'successText',
    label: t('Okay'),
  },
  error: {
    icon: <IconFire color="errorText" />,
    color: 'errorText',
    label: t('Error'),
  },
  timeout: {
    icon: <IconFire color="errorText" />,
    color: 'errorText',
    label: t('Timed Out'),
  },
  missed_checkin: {
    icon: <IconWarning color="warningText" />,
    color: 'warningText',
    label: t('Missed'),
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
