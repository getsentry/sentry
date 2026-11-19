import clamp from 'lodash/clamp';

import {getDuration} from '@sentry/scraps/duration';
import {InfoText} from '@sentry/scraps/info';
import {ExternalLink} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatSpanOperation} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {MODULE_DOC_LINK} from 'sentry/views/insights/database/settings';

interface Props {
  op?: string;
  percentage?: number;
  total?: number;
}

export function TimeSpentCell({percentage, total, op}: Props) {
  const formattedTotal = getDuration((total ?? 0) / 1000, {precision: 2, style: 'short'});
  const tooltip = percentage ? getTimeSpentExplanation(percentage, op) : undefined;

  return (
    <NumberContainer>
      <InfoText title={tooltip}>{defined(total) ? formattedTotal : '--'}</InfoText>
    </NumberContainer>
  );
}

function getTimeSpentExplanation(percentage: number, op?: string) {
  const formattedPercentage = formatPercentage(clamp(percentage ?? 0, 0, 1));

  return tct(
    'The application spent [percentage] of its total time on this [span]. Read more about Time Spent in our [documentation:documentation].',
    {
      percentage: formattedPercentage,
      span: formatSpanOperation(op),
      documentation: <ExternalLink href={`${MODULE_DOC_LINK}#what-is-time-spent`} />,
    }
  );
}
