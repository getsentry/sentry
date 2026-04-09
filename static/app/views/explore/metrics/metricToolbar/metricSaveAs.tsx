import {Button} from '@sentry/scraps/button';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useSaveAsMetricItems} from 'sentry/views/explore/metrics/useSaveAsMetricItems';

interface MetricSaveAsProps {
  size?: 'sm' | 'md';
}

export function MetricSaveAs({size = 'sm'}: MetricSaveAsProps) {
  const [interval] = useChartInterval();
  const items = useSaveAsMetricItems({interval});

  if (items.length === 0) {
    return null;
  }

  if (items.length === 1 && 'onAction' in items[0]! && !('children' in items[0])) {
    const item = items[0];
    return (
      <Button size={size} onClick={item.onAction} aria-label={item.textValue}>
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
          size={size}
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
