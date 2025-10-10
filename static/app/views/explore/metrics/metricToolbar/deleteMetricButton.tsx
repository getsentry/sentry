import {Button} from '@sentry/scraps/button';

import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useRemoveMetric} from 'sentry/views/explore/metrics/metricsQueryParams';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';

export function DeleteMetricButton() {
  const removeMetric = useRemoveMetric();
  const metricQueries = useMultiMetricsQueryParams();

  // Don't show delete button if there's only one metric
  if (metricQueries.length <= 1) {
    return null;
  }

  return (
    <Button
      size="sm"
      icon={<IconDelete />}
      aria-label={t('Delete metric')}
      onClick={removeMetric}
    />
  );
}
