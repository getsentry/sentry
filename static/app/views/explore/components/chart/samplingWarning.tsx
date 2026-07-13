import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconWarning} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {parseFunction} from 'sentry/utils/discover/fields';
import type {SamplingWarningReason} from 'sentry/views/explore/utils';

interface SamplingWarningProps {
  reason: SamplingWarningReason;
  yAxis: string;
}

export function SamplingWarning({yAxis, reason}: SamplingWarningProps) {
  const name = parseFunction(yAxis)?.name ?? yAxis;
  const nameNode = (
    <Text as="span" monospace>
      {name}
    </Text>
  );
  const title =
    reason === 'partialData'
      ? tct(
          'Due to the estimation being applied, [name] is likely to return unreliable results. Treat [name] for estimation purposes only.',
          {name: nameNode}
        )
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
