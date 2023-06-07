import {Tooltip} from 'sentry/components/tooltip';
import {getTooltip} from 'sentry/views/starfish/views/spans/types';

export function TimeSpentCell({
  formattedTimeSpent,
  totalSpanTime,
}: {
  formattedTimeSpent: string;
  totalSpanTime: number;
}) {
  const toolTip = getTooltip('timeSpent', totalSpanTime);
  return (
    <span>
      <Tooltip title={toolTip}>{formattedTimeSpent}</Tooltip>
    </span>
  );
}
