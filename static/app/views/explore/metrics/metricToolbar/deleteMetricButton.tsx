import {Button} from '@sentry/scraps/button';

import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
import {useRemoveMetric} from 'sentry/views/explore/metrics/metricsQueryParams';

export function DeleteMetricButton({disabled}: {disabled?: boolean}) {
  const organization = useOrganization();
  const removeMetric = useRemoveMetric();

  if (canUseMetricsUIRefresh(organization)) {
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

  return (
    <Button
      size="sm"
      icon={<IconDelete />}
      aria-label={t('Delete metric')}
      onClick={removeMetric}
      disabled={disabled}
      tooltipProps={{
        title: disabled ? t('This metric is used in an equation') : undefined,
      }}
    />
  );
}
