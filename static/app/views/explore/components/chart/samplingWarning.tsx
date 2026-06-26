import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconWarning} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {parseFunction} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {getSamplingWarningReason} from 'sentry/views/explore/utils';

interface SamplingWarningProps {
  series: TimeSeries[];
  yAxis: string;
  dataScanned?: 'full' | 'partial';
}

export function SamplingWarning({yAxis, series, dataScanned}: SamplingWarningProps) {
  const reason = getSamplingWarningReason(yAxis, series, dataScanned);
  if (!reason) {
    return null;
  }

  const name = parseFunction(yAxis)?.name ?? yAxis;
  const title =
    reason === 'partialData'
      ? tct(
          'Due to the estimation being applied, [name] is likely to return unreliable results. Treat [name] for estimation purposes only.',
          {name}
        )
      : tct(
          'Due to your configured sample rate, [name] is likely to return unreliable results. Increase your sample rate, or treat [name] for estimation purposes only.',
          {name}
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
