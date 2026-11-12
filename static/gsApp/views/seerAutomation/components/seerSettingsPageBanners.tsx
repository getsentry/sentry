import {Fragment} from 'react';

import {NoActiveSeerSubscriptionBanner} from 'sentry/components/seer/noActiveSeerSubscriptionBanner';
import {orgHasNewSeerPlan} from 'sentry/utils/seer/orgHasNewSeerPlan';
import {useCanWriteSettings} from 'sentry/utils/seer/useCanWriteSettings';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

import {
  SeerCodeReviewDeprecationAlert,
  SeerPricingChangeAlert,
} from 'getsentry/components/ai/seerPricingChangeAlert';
import {useSubscription} from 'getsentry/hooks/useSubscription';

export function SeerSettingsPageBanners({
  isCodeReviewPage = false,
}: {
  isCodeReviewPage?: boolean;
}) {
  const subscription = useSubscription();
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const hasNewSeerPlan = orgHasNewSeerPlan(organization);
  const hasLegacySeer = organization.features.includes('seer-added');
  const hasCodeReviewBeta = organization.features.includes('code-review-beta');
  const showNoActiveSeerSubscriptionBanner =
    !hasNewSeerPlan && (hasLegacySeer || hasCodeReviewBeta) && subscription?.canSelfServe;

  return (
    <Fragment>
      {isCodeReviewPage ? <SeerCodeReviewDeprecationAlert /> : <SeerPricingChangeAlert />}

      {showNoActiveSeerSubscriptionBanner ? <NoActiveSeerSubscriptionBanner /> : null}

      {canWrite ? null : <OrganizationPermissionAlert />}
    </Fragment>
  );
}
