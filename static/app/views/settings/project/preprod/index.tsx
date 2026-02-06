import {Fragment} from 'react';

import {ButtonBar} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PreprodQuotaAlert} from 'sentry/views/preprod/components/preprodQuotaAlert';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {FeatureFilter} from './featureFilter';
import {StatusCheckRules} from './statusCheckRules';

const SIZE_ENABLED_READ_KEY = 'sentry:preprod_size_enabled_by_customer';
const SIZE_ENABLED_WRITE_KEY = 'preprodSizeEnabledByCustomer';
const SIZE_ENABLED_QUERY_READ_KEY = 'sentry:preprod_size_enabled_query';
const SIZE_ENABLED_QUERY_WRITE_KEY = 'preprodSizeEnabledQuery';

const DISTRIBUTION_ENABLED_READ_KEY = 'sentry:preprod_distribution_enabled_by_customer';
const DISTRIBUTION_ENABLED_WRITE_KEY = 'preprodDistributionEnabledByCustomer';
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
            enabledReadKey={SIZE_ENABLED_READ_KEY}
            enabledWriteKey={SIZE_ENABLED_WRITE_KEY}
            queryReadKey={SIZE_ENABLED_QUERY_READ_KEY}
            queryWriteKey={SIZE_ENABLED_QUERY_WRITE_KEY}
            title={t('Size Analysis')}
            successMessage={t('Size analysis settings updated')}
            docsUrl="https://docs.sentry.io/product/size-analysis/#configuring-size-analysis-uploads"
          />
          <Feature features="organizations:preprod-build-distribution">
            <FeatureFilter
              enabledReadKey={DISTRIBUTION_ENABLED_READ_KEY}
              enabledWriteKey={DISTRIBUTION_ENABLED_WRITE_KEY}
              queryReadKey={DISTRIBUTION_ENABLED_QUERY_READ_KEY}
              queryWriteKey={DISTRIBUTION_ENABLED_QUERY_WRITE_KEY}
              title={t('Build Distribution')}
              successMessage={t('Build distribution settings updated')}
              docsUrl="https://docs.sentry.io/product/build-distribution/"
              display={PreprodBuildsDisplay.DISTRIBUTION}
            />
          </Feature>
        </Stack>
      </Feature>
    </Fragment>
  );
}
