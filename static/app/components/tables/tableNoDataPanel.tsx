import {EmptyState} from '@sentry/scraps/emptyState';

import {t} from 'sentry/locale';

export function TableNoDataPanel() {
  return (
    <EmptyState
      title={t('No results found')}
      description={t('Try adjusting the filters.')}
      contentGap="sm"
      textAlign="center"
    />
  );
}
