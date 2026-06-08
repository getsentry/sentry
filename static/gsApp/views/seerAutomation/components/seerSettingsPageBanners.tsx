import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useSubscription} from 'getsentry/hooks/useSubscription';
import {NoActiveSeerSubscriptionBanner} from 'getsentry/views/seerAutomation/components/noActiveSeerSubscriptionBanner';
import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

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

      {canWrite ? null : (
        <Alert data-test-id="org-permission-alert" variant="warning">
          {t(
            'These settings can only be edited by users with the organization owner or manager role.'
          )}
        </Alert>
      )}
    </Fragment>
  );
}
