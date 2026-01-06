import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

export default function PreprodSettings() {
  return (
    <Fragment>
      <Feature features="organizations:preprod-issues" renderDisabled>
        <SentryDocumentTitle title={t('Preprod')} />
        <SettingsPageHeader
          title={t('Preprod')}
          action={
            <ButtonBar gap="lg">
              <FeedbackButton />
            </ButtonBar>
          }
        />
      </Feature>
    </Fragment>
  );
}
