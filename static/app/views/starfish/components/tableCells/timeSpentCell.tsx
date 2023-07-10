import {Tooltip} from 'sentry/components/tooltip';
import {formatPercentage} from 'sentry/utils/formatters';
import {TextAlignRight} from 'sentry/views/starfish/components/textAlign';
import {getTooltip} from 'sentry/views/starfish/views/spans/types';

export function TimeSpentCell({
  timeSpentPercentage,
  totalSpanTime,
}: {
  timeSpentPercentage: number;
  totalSpanTime: number;
}) {
  const toolTip = getTooltip('timeSpent', totalSpanTime);
  const percentage = timeSpentPercentage > 1 ? 1 : timeSpentPercentage;
  const undefinedTimeSpentText = '--%';
  return (
    <TextAlignRight>
      {percentage >= 0 ? (
        <Tooltip isHoverable title={toolTip}>
          {formatPercentage(percentage)}
        </Tooltip>
      ) : (
        undefinedTimeSpentText
      )}
    </TextAlignRight>
  );
}
