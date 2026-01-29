import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useSaveAsMetricItems} from 'sentry/views/explore/metrics/useSaveAsMetricItems';

export function MetricSaveAs() {
  const [interval] = useChartInterval();
  const items = useSaveAsMetricItems({interval});

  const hasMultiVisualize = useOrganization().features.includes(
    'tracemetrics-overlay-charts-ui'
  );

  if (items.length === 0 || hasMultiVisualize) {
    return null;
  }

  if (items.length === 1 && 'onAction' in items[0]! && !('children' in items[0])) {
    const item = items[0];
    return (
      <Button size="sm" onClick={item.onAction} aria-label={item.textValue}>
        {t('Save as')}…
      </Button>
    );
  }

  return (
    <DropdownMenu
      items={items}
      trigger={triggerProps => (
        <Button
          {...triggerProps}
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
  );
}
