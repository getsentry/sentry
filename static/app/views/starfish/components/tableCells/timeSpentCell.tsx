import clamp from 'lodash/clamp';

import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';
import {TextAlignRight} from 'sentry/views/starfish/components/textAlign';
import {getSpanOperationDescription} from 'sentry/views/starfish/views/spanSummaryPage/getSpanOperationDescription';

interface Props {
  op?: string;
  percentage?: number;
  total?: number;
}

export function TimeSpentCell({percentage, total, op}: Props) {
  const formattedPercentage = formatPercentage(clamp(percentage ?? 0, 0, 1));
  const formattedTotal = getDuration((total ?? 0) / 1000, 2, true);
  const tooltip = tct(
    'The application spent [percentage] of its total time on this [span].',
    {
      percentage: formattedPercentage,
      span: getSpanOperationDescription(op ?? ''),
    }
  );

  return (
    <TextAlignRight>
      <Tooltip isHoverable title={tooltip} showUnderline>
        {defined(total) ? formattedTotal : '--'}
      </Tooltip>
    </TextAlignRight>
  );
}
