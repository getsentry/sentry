import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
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
        <TextBlock>
          {t(
            'Configure status checks and thresholds for your mobile build size analysis.'
          )}
        </TextBlock>
        <Stack gap="lg">
          <StatusCheckRules />
          <FeatureFilter
            settingsWriteKey={SIZE_ENABLED_QUERY_WRITE_KEY}
            settingsReadKey={SIZE_ENABLED_QUERY_READ_KEY}
            title={t('Size Analysis')}
            successMessage={t('Size filter updated')}
          >
            <Text>
              {t(
                "Size Analysis helps monitor your mobile app's size in pre-production to prevent unexpected size increases (regressions) from reaching users."
              )}
            </Text>
          </FeatureFilter>
          <FeatureFilter
            settingsWriteKey={DISTRIBUTION_ENABLED_QUERY_WRITE_KEY}
            settingsReadKey={DISTRIBUTION_ENABLED_QUERY_READ_KEY}
            title={t('Build Distribution')}
            successMessage={t('Distribution filter updated')}
          >
            <Text>
              {t(
                'Build Distribution helps you securely distribute iOS builds to your internal teams and beta testers. Streamline your distribution workflow with automated uploads from CI.'
              )}
            </Text>
          </FeatureFilter>
        </Stack>
      </Feature>
    </Fragment>
  );
}
