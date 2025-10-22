import {Button} from '@sentry/scraps/button';

import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useRemoveMetric} from 'sentry/views/explore/metrics/metricsQueryParams';

export function DeleteMetricButton() {
  const removeMetric = useRemoveMetric();

  return (
    <Button
      size="sm"
      icon={<IconDelete />}
      aria-label={t('Delete metric')}
      onClick={removeMetric}
    />
  );
}
