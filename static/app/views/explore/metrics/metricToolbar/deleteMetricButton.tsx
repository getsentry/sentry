import {Button} from '@sentry/scraps/button';

import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useRemoveMetric} from 'sentry/views/explore/metrics/metricsQueryParams';

export function DeleteMetricButton({disabledReason}: {disabledReason?: string}) {
  const removeMetric = useRemoveMetric();

  return (
    <Button
      priority="transparent"
      icon={<IconDelete />}
      size="zero"
      onClick={removeMetric}
      disabled={disabledReason !== undefined}
      tooltipProps={{title: disabledReason}}
      aria-label={t('Delete Metric')}
    />
  );
}
