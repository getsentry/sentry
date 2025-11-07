import {Fragment} from 'react';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';

function AdminOverview() {
  return (
    <SentryDocumentTitle title={t('Admin Overview')}>
      <Fragment>
        <h3>{t('System Overview')}</h3>
      </Fragment>
    </SentryDocumentTitle>
  );
}

export default AdminOverview;
