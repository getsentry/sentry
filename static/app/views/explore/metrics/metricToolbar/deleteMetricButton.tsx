import {Button} from '@sentry/scraps/button';

import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
import {useRemoveMetric} from 'sentry/views/explore/metrics/metricsQueryParams';

export function DeleteMetricButton() {
  const organization = useOrganization();
  const removeMetric = useRemoveMetric();

  if (canUseMetricsUIRefresh(organization)) {
    return (
      <Button
        priority="transparent"
        icon={<IconDelete />}
        size="zero"
        onClick={removeMetric}
        aria-label={t('Remove Overlay')}
      />
    );
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
