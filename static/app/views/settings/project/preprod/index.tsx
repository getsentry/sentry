import {Fragment} from 'react';

// import Feature from 'sentry/components/acl/feature';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {StatusCheckRules} from './statusCheckRules';

export default function PreprodSettings() {
  return (
    <Fragment>
      {/* <Feature features="organizations:preprod-issues" renderDisabled> */}
      <SentryDocumentTitle title={t('Preprod')} />
      <SettingsPageHeader
        title={t('Preprod')}
        action={
          <ButtonBar gap="lg">
            <FeedbackButton />
          </ButtonBar>
        }
      />
      <TextBlock>
        {t('Configure status checks and thresholds for your mobile build size analysis.')}
      </TextBlock>
      <StatusCheckRules />
      {/* </Feature> */}
    </Fragment>
  );
}
