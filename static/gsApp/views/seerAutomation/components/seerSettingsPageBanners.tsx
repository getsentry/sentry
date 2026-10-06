import {Fragment} from 'react';

import {NoActiveSeerSubscriptionBanner} from 'sentry/components/seer/noActiveSeerSubscriptionBanner';
import {useCanWriteSettings} from 'sentry/utils/seer/useCanWriteSettings';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

import {useSubscription} from 'getsentry/hooks/useSubscription';

export function SeerSettingsPageBanners() {
  const subscription = useSubscription();
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const hasSeatBasedSeer = organization.features.includes('seat-based-seer-enabled');
  const hasLegacySeer = organization.features.includes('seer-added');
  const hasCodeReviewBeta = organization.features.includes('code-review-beta');
  const showNoActiveSeerSubscriptionBanner =
    !hasSeatBasedSeer &&
    (hasLegacySeer || hasCodeReviewBeta) &&
    subscription?.canSelfServe;

  return (
    <Fragment>
      {showNoActiveSeerSubscriptionBanner ? <NoActiveSeerSubscriptionBanner /> : null}

      {canWrite ? null : <OrganizationPermissionAlert />}
    </Fragment>
  );
}
