import {Tooltip} from 'sentry/components/tooltip';
import {getTooltip} from 'sentry/views/starfish/views/spans/types';

export function TimeSpentCell({
  formattedTimeSpent,
  totalSpanTime,
  totalAppTime,
}: {
  formattedTimeSpent: string;
  totalAppTime: number;
  totalSpanTime: number;
}) {
  const toolTip = getTooltip('timeSpent', totalSpanTime, totalAppTime);
  return (
    <span>
      <Tooltip title={toolTip}>{formattedTimeSpent}</Tooltip>
    </span>
  );
}
