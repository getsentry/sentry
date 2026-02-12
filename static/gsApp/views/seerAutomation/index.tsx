import {Fragment} from 'react';
import {Outlet} from 'react-router-dom';

import {Stack} from '@sentry/scraps/layout';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {NoAccess} from 'sentry/components/noAccess';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import AiSetupDataConsent from 'getsentry/components/ai/AiSetupDataConsent';

export default function SeerAutomationRoot() {
  const organization = useOrganization();
  const {isLoading, billing} = useOrganizationSeerSetup();

  if (organization.hideAiFeatures) {
    return (
      <AnalyticsArea name="seer">
        <NoAccess />
      </AnalyticsArea>
    );
  }

  // Show loading placeholders while checking setup
  if (isLoading) {
    return (
      <AnalyticsArea name="seer">
        <Stack gap="lg">
          <SentryDocumentTitle title={t('Seer Automation')} orgSlug={organization.slug} />
          <Placeholder height="60px" />
          <Placeholder height="200px" />
          <Placeholder height="200px" />
        </Stack>
      </AnalyticsArea>
    );
  }

  // Check if setup is needed
  const needsBilling =
    !billing.hasAutofixQuota && organization.features.includes('seer-billing');

  // Show setup screen if needed
  if (needsBilling) {
    return (
      <AnalyticsArea name="seer">
        <Fragment>
          <SentryDocumentTitle title={t('Seer Automation')} orgSlug={organization.slug} />
          <AiSetupDataConsent />
        </Fragment>
      </AnalyticsArea>
    );
  }

  return (
    <AnalyticsArea name="seer">
      <Outlet />
    </AnalyticsArea>
  );
}
