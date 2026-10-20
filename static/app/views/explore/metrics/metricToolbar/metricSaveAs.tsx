import {Button} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useMetricsHasTransformations} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {useSaveAsMetricItems} from 'sentry/views/explore/metrics/useSaveAsMetricItems';

interface MetricSaveAsProps {
  size?: 'sm' | 'md';
}

export function MetricSaveAs({size = 'sm'}: MetricSaveAsProps) {
  const [interval] = useChartInterval();
  const items = useSaveAsMetricItems({interval});
  const hasTransformations = useMetricsHasTransformations();
  const tooltipProps = hasTransformations
    ? {title: t('Queries with transformations cannot be saved yet.')}
    : undefined;

  if (items.length === 0) {
    return null;
  }

  if (items.length === 1 && 'onAction' in items[0]! && !('children' in items[0])) {
    const item = items[0];
    return (
      <Button
        size={size}
        variant="primary"
        onClick={item.onAction}
        aria-label={item.textValue}
        disabled={hasTransformations || ('disabled' in item && item.disabled)}
        tooltipProps={tooltipProps}
      >
        {t('Save as')}
      </Button>
    );
  }

  return (
    <DropdownMenu
      items={items}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          showChevron={false}
          {...triggerProps}
          size={size}
          variant="primary"
          aria-label={t('Save as')}
          disabled={hasTransformations}
          tooltipProps={tooltipProps}
        >
          {t('Save as')}
        </OverlayTrigger.Button>
      )}
    />
  );
}
