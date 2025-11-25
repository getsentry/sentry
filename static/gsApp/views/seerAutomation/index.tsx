import {Fragment} from 'react';
import {Outlet} from 'react-router-dom';

import {Stack} from '@sentry/scraps/layout/stack';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {NoAccess} from 'sentry/components/noAccess';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import AiSetupDataConsent from 'getsentry/components/ai/AiSetupDataConsent';

export default function SeerAutomationRoot() {
  const organization = useOrganization();
  const {isLoading, billing, setupAcknowledgement} = useOrganizationSeerSetup();

  if (organization.hideAiFeatures) {
    return <NoAccess />;
  }

  // Show loading placeholders while checking setup
  if (isLoading) {
    return (
      <Stack gap="lg">
        <SentryDocumentTitle title={t('Seer Automation')} orgSlug={organization.slug} />
        <Placeholder height="60px" />
        <Placeholder height="200px" />
        <Placeholder height="200px" />
      </Stack>
    );
  }

  // Check if setup is needed
  const needsOrgAcknowledgement = !setupAcknowledgement.orgHasAcknowledged;
  const needsBilling =
    !billing.hasAutofixQuota && organization.features.includes('seer-billing');

  const needsSetup = needsOrgAcknowledgement || needsBilling;

  // Show setup screen if needed
  if (needsSetup) {
    return (
      <Fragment>
        <SentryDocumentTitle title={t('Seer Automation')} orgSlug={organization.slug} />
        <AiSetupDataConsent />
      </Fragment>
    );
  }

  return <Outlet />;
}
