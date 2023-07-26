import clamp from 'lodash/clamp';

import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';
import {TextAlignRight} from 'sentry/views/starfish/components/textAlign';

interface Props {
  percentage?: number;
  total?: number;
}

export function TimeSpentCell({percentage, total}: Props) {
  const formattedPercentage = formatPercentage(clamp(percentage ?? 0, 0, 1));
  const formattedTotal = getDuration((total ?? 0) / 1000, 1);
  const tooltip = tct(
    'The application spent [percentage] of its total time on this span.',
    {
      percentage: formattedPercentage,
    }
  );

  return (
    <TextAlignRight>
      <Tooltip isHoverable title={tooltip} showUnderline>
        {defined(total) ? formattedTotal : '--'} {'('}
        {defined(percentage) ? formattedPercentage : '--%'}
        {')'}
      </Tooltip>
    </TextAlignRight>
  );
}
