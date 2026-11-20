import {EmptyState} from '@sentry/scraps/emptyState';

import {t} from 'sentry/locale';

export default function InboxEmptyPreview() {
  return (
    <EmptyState
      padding="2xl"
      title={t('No item selected')}
      description={t('Select an item from your inbox to preview it here.')}
    />
  );
}
