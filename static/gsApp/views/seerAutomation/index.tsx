import {Fragment} from 'react';
import {Outlet} from 'react-router-dom';

import {Stack} from '@sentry/scraps/layout/stack';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {NoAccess} from 'sentry/components/noAccess';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import AiSetupDataConsent from 'getsentry/components/ai/AiSetupDataConsent';
import type {BillingSeatAssignment} from 'getsentry/types';

export default function SeerAutomationRoot() {
  const organization = useOrganization();
  const {isLoading, billing, setupAcknowledgement} = useOrganizationSeerSetup();

  // Query billed seats as a fallback when billing check fails.
  // This allows users who have downgraded mid-period but still have seats assigned
  // to continue managing their Seer settings.
  const needsBillingCheck =
    !billing.hasAutofixQuota && organization.features.includes('seer-billing');

  const {data: billedSeats, isPending: isLoadingBilledSeats} = useApiQuery<
    BillingSeatAssignment[]
  >([`/customers/${organization.slug}/billing-seats/current/?billingMetric=seerUsers`], {
    staleTime: 0,
    enabled: needsBillingCheck && !isLoading,
  });

  const hasBilledSeats = billedSeats && billedSeats.length > 0;

  if (organization.hideAiFeatures) {
    return <NoAccess />;
  }

  // Show loading placeholders while checking setup
  if (isLoading || (needsBillingCheck && isLoadingBilledSeats)) {
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
  // If billing check fails but user has billed seats, allow access
  const needsBilling = needsBillingCheck && !hasBilledSeats;

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
