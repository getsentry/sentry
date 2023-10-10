import clamp from 'lodash/clamp';

import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';

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
  const formattedPercentage = formatPercentage(clamp(percentage ?? 0, 0, 1));
  const formattedTotal = getDuration((total ?? 0) / 1000, 2, true);
  const tooltip = tct(
    'The application spent [percentage] of its total time on this [span]. Read more about Time Spent in our [documentation:documentation].',
    {
      percentage: formattedPercentage,
      span: getSpanOperationDescription(op),
      documentation: (
        <ExternalLink href="https://docs.sentry.io/product/performance/queries/#what-is-time-spent" />
      ),
    }
  );

  return (
    <NumberContainer {...containerProps}>
      <Tooltip isHoverable title={tooltip} showUnderline>
        {defined(total) ? formattedTotal : '--'}
      </Tooltip>
    </NumberContainer>
  );
}

// TODO: This should use `getSpanOperationDescription` but it uppercases the
// names. We should update `getSpanOperationDescription` to not uppercase the
// descriptions needlessly, and use it here. Also, the names here are a little
// shorter, which is friendlier
function getSpanOperationDescription(spanOp?: string) {
  if (spanOp?.startsWith('http')) {
    return t('request');
  }

  if (spanOp?.startsWith('db')) {
    return t('query');
  }

  if (spanOp?.startsWith('task')) {
    return t('task');
  }

  if (spanOp?.startsWith('serialize')) {
    return t('serializer');
  }

  if (spanOp?.startsWith('middleware')) {
    return t('middleware');
  }

  return t('span');
}
