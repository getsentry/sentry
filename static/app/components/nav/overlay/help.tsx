import {Fragment} from 'react';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';

export default function Help() {
  return (
    <Fragment>
      <Link to="https://sentry.zendesk.com/hc/en-us">{t('Visit Help Center')}</Link>
      <Link to="https://discord.com/invite/sentry">{t('Join our Discord')}</Link>
    </Fragment>
  );
}
