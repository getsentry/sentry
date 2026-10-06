import {EmptyState} from '@sentry/scraps/emptyState';

import {t} from 'sentry/locale';

export function WidgetNoDataPanel() {
  return (
    <EmptyState
      title={t('No data to plot.')}
      description={t('Try adjusting the filters.')}
    />
  );
}
