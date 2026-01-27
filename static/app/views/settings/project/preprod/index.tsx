import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Stack} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

// eslint-disable-next-line boundaries/element-types -- getsentry subscription for quota checking
import useSubscription from 'getsentry/hooks/useSubscription';

import {FeatureFilter} from './featureFilter';
import {StatusCheckRules} from './statusCheckRules';

const SIZE_ENABLED_QUERY_READ_KEY = 'sentry:preprod_size_enabled_query';
const SIZE_ENABLED_QUERY_WRITE_KEY = 'preprodSizeEnabledQuery';

const DISTRIBUTION_ENABLED_QUERY_READ_KEY = 'sentry:preprod_distribution_enabled_query';
const DISTRIBUTION_ENABLED_QUERY_WRITE_KEY = 'preprodDistributionEnabledQuery';

export default function PreprodSettings() {
  const organization = useOrganization();
  const subscription = useSubscription();
  const sizeAnalysisQuota = subscription?.categories[DataCategory.SIZE_ANALYSIS];
  const isQuotaExceeded = sizeAnalysisQuota?.usageExceeded ?? false;

  return (
    <Fragment>
      <Feature features="organizations:preprod-issues" renderDisabled>
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
        {isQuotaExceeded && (
          <Alert.Container>
            <Alert variant="warning">
              {tct(
                'Your organization has used your full quota of [quota] Size Analysis builds this billing period. [link:Upgrade your plan] to continue uploading builds.',
                {
                  quota: sizeAnalysisQuota?.reserved ?? 100,
                  link: <Link to={`/settings/${organization.slug}/billing/`} />,
                }
              )}
            </Alert>
          </Alert.Container>
        )}
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
            display={PreprodBuildsDisplay.DISTRIBUTION}
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
