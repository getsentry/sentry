import {EmptyState} from '@sentry/scraps/emptyState';

import {t} from 'sentry/locale';

/**
 * Shown when a widget's query reached outside of retention. The data is gone
 * rather than missing, so the default "adjust the filters" hint doesn't apply.
 */
export const OUTSIDE_RETENTION_DESCRIPTION = t(
  'Events from this date range are outside your retention period.'
);

interface WidgetNoDataPanelProps {
  description?: string;
}

export function WidgetNoDataPanel({description}: WidgetNoDataPanelProps = {}) {
  return (
    <EmptyState
      title={t('No data to plot.')}
      description={description ?? t('Try adjusting the filters.')}
    />
  );
}
