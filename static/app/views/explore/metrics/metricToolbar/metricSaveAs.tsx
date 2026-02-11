import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {useSaveAsMetricItems} from 'sentry/views/explore/metrics/useSaveAsMetricItems';

export function MetricSaveAs() {
  const [interval] = useChartInterval();
  const items = useSaveAsMetricItems({interval});
  const metricQueries = useMultiMetricsQueryParams();

  const hasMultiVisualize = useOrganization().features.includes(
    'tracemetrics-overlay-charts-ui'
  );

  const hasMultiAggregate = metricQueries.some(
    query => query.queryParams.visualizes.length > 1
  );

  const isMultiVisDisabled = hasMultiVisualize && hasMultiAggregate;

  if (items.length === 0) {
    return null;
  }

  if (items.length === 1 && 'onAction' in items[0]! && !('children' in items[0])) {
    const item = items[0];
    return (
      <Tooltip
        disabled={!isMultiVisDisabled}
        title={t('Saving multi-aggregate metrics is not supported during early access.')}
      >
        <Button
          size="sm"
          onClick={item.onAction}
          aria-label={item.textValue}
          disabled={isMultiVisDisabled}
        >
          {t('Save as')}…
        </Button>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      disabled={!isMultiVisDisabled}
      title={t('Saving multi-aggregate metrics is not supported during early access.')}
    >
      <DropdownMenu
        isDisabled={isMultiVisDisabled}
        items={items}
        trigger={triggerProps => (
          <Button
            {...triggerProps}
            disabled={isMultiVisDisabled}
            size="sm"
            aria-label={t('Save as')}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              triggerProps.onClick?.(e);
            }}
          >
            {t('Save as')}…
          </Button>
        )}
      />
    </Tooltip>
  );
}
