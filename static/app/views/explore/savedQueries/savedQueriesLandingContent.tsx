import {t} from 'sentry/locale';

import {SavedQueriesTable} from './savedQueriesTable';

export function SavedQueriesLandingContent() {
  return (
    <div>
      <h4>{t('Owned by Me')}</h4>
      <SavedQueriesTable mode="owned" />
      <h4>{t('Shared with Me')}</h4>
      <SavedQueriesTable mode="shared" perPage={8} />
    </div>
  );
}
