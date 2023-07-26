import {IconCheckmark, IconFire, IconPause, IconTimer, IconWarning} from 'sentry/icons';
import {StatsBucket} from 'sentry/views/monitors/components/overviewTimeline/types';
import {CheckInStatus, MonitorStatus} from 'sentry/views/monitors/types';

// Orders the status in terms of precedence for showing to the user
export const CHECKIN_STATUS_PRECEDENT = [
  CheckInStatus.OK,
  CheckInStatus.MISSED,
  CheckInStatus.TIMEOUT,
  CheckInStatus.ERROR,
] satisfies Array<keyof StatsBucket>;

export const statusIconMap: Record<MonitorStatus, React.ReactNode> = {
  ok: <IconCheckmark color="successText" />,
  error: <IconFire color="errorText" />,
  timeout: <IconFire color="errorText" />,
  missed_checkin: <IconWarning color="warningText" />,
  active: <IconTimer color="subText" />,
  disabled: <IconPause color="subText" size="xs" />,
};
