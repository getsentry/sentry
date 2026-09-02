import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconWarning} from 'sentry/icons';
import {tct} from 'sentry/locale';
import type {SamplingWarningReason} from 'sentry/views/explore/utils';
import {parseConditionalAggregate} from 'sentry/views/explore/utils/conditionalAggregate';

interface SamplingWarningProps {
  reason: SamplingWarningReason;
  yAxis: string;
}

export function SamplingWarning({yAxis, reason}: SamplingWarningProps) {
  const name = parseConditionalAggregate(yAxis)?.name ?? yAxis;
  const nameNode = (
    <Text as="span" monospace>
      {name}
    </Text>
  );
  const title =
    reason === 'partialData'
      ? tct('[name] is unreliable due to sampling', {name: nameNode})
      : tct(
          'Due to your configured sample rate, [name] is likely to return unreliable results. Increase your sample rate, or treat [name] for estimation purposes only.',
          {name: nameNode}
        );

  return (
    <Tooltip
      isHoverable
      skipWrapper
      position="top"
      title={<Text as="span">{title}</Text>}
    >
      <IconWarning variant="warning" size="sm" data-test-id="sampling-warning" />
    </Tooltip>
  );
}
