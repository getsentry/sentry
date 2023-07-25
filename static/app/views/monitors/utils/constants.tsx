import {
  IconCheckmark,
  IconExclamation,
  IconFire,
  IconPause,
  IconTimer,
} from 'sentry/icons';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {ColorOrAlias} from 'sentry/utils/theme';
import {StatsBucket} from 'sentry/views/monitors/components/overviewTimeline/types';
import {CheckInStatus, MonitorStatus} from 'sentry/views/monitors/types';

// Orders the status in terms of precedence for showing to the user
export const CHECKIN_STATUS_PRECEDENT = [
  CheckInStatus.OK,
  CheckInStatus.MISSED,
  CheckInStatus.TIMEOUT,
  CheckInStatus.ERROR,
] satisfies Array<keyof StatsBucket>;

interface StatusData {
  Icon: React.ComponentType<SVGIconProps>;
  color: ColorOrAlias;
}
export const statusMap: Record<MonitorStatus, StatusData> = {
  ok: {
    Icon: IconCheckmark,
    color: 'successText',
  },
  error: {
    Icon: IconFire,
    color: 'errorText',
  },
  timeout: {
    Icon: IconFire,
    color: 'errorText',
  },
  missed_checkin: {
    Icon: IconExclamation,
    color: 'warningText',
  },
  active: {
    Icon: IconTimer,
    color: 'subText',
  },
  disabled: {
    Icon: (p: SVGIconProps) => <IconPause {...p} size="xs" />,
    color: 'subText',
  },
};
