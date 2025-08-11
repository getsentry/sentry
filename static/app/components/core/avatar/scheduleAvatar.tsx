import {BaseAvatar, type BaseAvatarProps} from 'sentry/components/avatar/baseAvatar';
import type {RotationSchedule} from 'sentry/views/escalationPolicies/queries/useFetchRotationSchedules';

interface Props extends BaseAvatarProps {
  schedule: RotationSchedule | null | undefined;
}

function ScheduleAvatar({schedule, tooltip: tooltipProp, ...props}: Props) {
  if (!schedule) {
    return null;
  }

  const tooltip = tooltipProp ?? `#${schedule.name}`;

  return (
    <BaseAvatar
      {...props}
      type={'letter_avatar'}
      letterId={schedule.name}
      tooltip={tooltip}
      title={schedule.name}
    />
  );
}

export default ScheduleAvatar;
