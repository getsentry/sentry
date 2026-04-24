import {Button} from '@sentry/scraps/button';

import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useRemoveMetric} from 'sentry/views/explore/metrics/metricsQueryParams';

export function DeleteMetricButton({disabled}: {disabled?: boolean}) {
  const removeMetric = useRemoveMetric();

  return (
    <Button
      priority="transparent"
      icon={<IconDelete />}
      size="zero"
      onClick={removeMetric}
      disabled={disabled}
      tooltipProps={{
        title: disabled ? t('This metric is used in an equation') : undefined,
      }}
      aria-label={t('Delete Metric')}
    />
  );
}
