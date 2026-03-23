import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {NoActiveSeerSubscriptionBanner} from 'getsentry/views/seerAutomation/components/noActiveSeerSubscriptionBanner';
import {SeerWizardSetupBanner} from 'getsentry/views/seerAutomation/components/seerWizardSetupBanner';
import {SettingsPageTabs} from 'getsentry/views/seerAutomation/components/settingsPageTabs';
import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

interface Props {
  children: React.ReactNode;
}

export function SeerSettingsPageContent({children}: Props) {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const hasSeatBasedSeer = organization.features.includes('seat-based-seer-enabled');
  const hasLegacySeer = organization.features.includes('seer-added');
  const hasCodeReviewBeta = organization.features.includes('code-review-beta');
  const showNoActiveSeerSubscriptionBanner =
    !hasSeatBasedSeer && (hasLegacySeer || hasCodeReviewBeta);

  return (
    <Stack gap="lg">
      <SeerWizardSetupBanner />
      {showNoActiveSeerSubscriptionBanner ? <NoActiveSeerSubscriptionBanner /> : null}

      <SettingsPageTabs />

      {canWrite ? null : (
        <Alert data-test-id="org-permission-alert" variant="warning">
          {t(
            'These settings can only be edited by users with the organization owner or manager role.'
          )}
        </Alert>
      )}

      {children}
    </Stack>
  );
}
