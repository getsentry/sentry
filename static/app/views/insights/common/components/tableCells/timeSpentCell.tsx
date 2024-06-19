import clamp from 'lodash/clamp';

import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {NumberContainer} from 'sentry/utils/discover/styles';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatSpanOperation} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {MODULE_DOC_LINK} from 'sentry/views/insights/database/settings';

interface Props {
  containerProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
  op?: string;
  percentage?: number;
  total?: number;
}

export function TimeSpentCell({percentage, total, op, containerProps}: Props) {
  const formattedTotal = getDuration((total ?? 0) / 1000, 2, true);
  const tooltip = percentage ? getTimeSpentExplanation(percentage, op) : undefined;

  return (
    <NumberContainer {...containerProps}>
      <Tooltip isHoverable title={tooltip} showUnderline>
        {defined(total) ? formattedTotal : '--'}
      </Tooltip>
    </NumberContainer>
  );
}

export function getTimeSpentExplanation(percentage: number, op?: string) {
  const formattedPercentage = formatPercentage(clamp(percentage ?? 0, 0, 1));

  return tct(
    'The application spent [percentage] of its total time on this [span]. Read more about Time Spent in our [documentation:documentation].',
    {
      percentage: formattedPercentage,
      span: formatSpanOperation(op, 'short'),
      documentation: <ExternalLink href={`${MODULE_DOC_LINK}#what-is-time-spent`} />,
    }
  );
}
