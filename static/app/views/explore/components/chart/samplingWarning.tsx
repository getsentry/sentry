import {Tooltip} from '@sentry/scraps/tooltip';

import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
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
      ? t(
          'Due to the estimation being applied, %s is likely to return unreliable results. Treat %s for estimation purposes only.',
          name,
          name
        )
      : t(
          'Due to your configured sample rate, %s is likely to return unreliable results. Increase your sample rate, or treat %s for estimation purposes only.',
          name,
          name
        );

  return (
    <Tooltip isHoverable skipWrapper position="top" title={title}>
      <IconWarning variant="warning" size="sm" />
    </Tooltip>
  );
}
