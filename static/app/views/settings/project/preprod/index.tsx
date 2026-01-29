import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Stack} from 'sentry/components/core/layout';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PreprodQuotaAlert} from 'sentry/views/preprod/components/preprodQuotaAlert';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {FeatureFilter} from './featureFilter';
import {StatusCheckRules} from './statusCheckRules';

const SIZE_ENABLED_QUERY_READ_KEY = 'sentry:preprod_size_enabled_query';
const SIZE_ENABLED_QUERY_WRITE_KEY = 'preprodSizeEnabledQuery';

const DISTRIBUTION_ENABLED_QUERY_READ_KEY = 'sentry:preprod_distribution_enabled_query';
const DISTRIBUTION_ENABLED_QUERY_WRITE_KEY = 'preprodDistributionEnabledQuery';

export default function PreprodSettings() {
  return (
    <Fragment>
      <Feature features="organizations:preprod-frontend-routes" renderDisabled>
        <SentryDocumentTitle title={t('Mobile Builds')} />
        <SettingsPageHeader
          title={t('Mobile Builds')}
          action={
            <ButtonBar gap="lg">
              <FeedbackButton />
            </ButtonBar>
          }
        />
        <TextBlock>
          {t(
            'Configure status checks and thresholds for your mobile build size analysis.'
          )}
        </TextBlock>
        <PreprodQuotaAlert />
        <Stack gap="lg">
          <StatusCheckRules />
          <FeatureFilter
            settingsWriteKey={SIZE_ENABLED_QUERY_WRITE_KEY}
            settingsReadKey={SIZE_ENABLED_QUERY_READ_KEY}
            title={t('Size Analysis')}
            successMessage={t('Size filter updated')}
          />
          <Feature features="organizations:preprod-build-distribution">
            <FeatureFilter
              settingsWriteKey={DISTRIBUTION_ENABLED_QUERY_WRITE_KEY}
              settingsReadKey={DISTRIBUTION_ENABLED_QUERY_READ_KEY}
              title={t('Build Distribution')}
              successMessage={t('Distribution filter updated')}
              display={PreprodBuildsDisplay.DISTRIBUTION}
            />
          </Feature>
        </Stack>
      </Feature>
    </Fragment>
  );
}
