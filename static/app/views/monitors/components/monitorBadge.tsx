import {DiamondStatus} from 'sentry/components/diamondStatus';
import {
  IconCheckmark,
  IconExclamation,
  IconFire,
  IconPause,
  IconTimer,
} from 'sentry/icons';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {ColorOrAlias} from 'sentry/utils/theme';

import {MonitorStatus} from '../types';

interface MonitorBadgeProps {
  status: MonitorStatus;
}

interface StatusData {
  Icon: React.ComponentType<SVGIconProps>;
  color: ColorOrAlias;
}

function MonitorBadge({status}: MonitorBadgeProps) {
  const {Icon, color} = statusMap[status] ?? statusMap.ok;

  return <DiamondStatus icon={Icon} color={color} />;
}

// TODO(ts): Use satisfies
const statusMap: Record<MonitorStatus, StatusData> = {
  ok: {
    Icon: IconCheckmark,
    color: 'successText',
  },
  error: {
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

export {MonitorBadge};
