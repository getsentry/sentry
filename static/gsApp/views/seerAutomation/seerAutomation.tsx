import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {showNewSeer} from 'sentry/utils/seer/showNewSeer';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {NoActiveSeerSubscriptionBanner} from 'getsentry/views/seerAutomation/components/noActiveSeerSubscriptionBanner';
import {SeerAutomationDefault} from 'getsentry/views/seerAutomation/components/seerAutomationDefault';
import {SeerAutomationProjectList} from 'getsentry/views/seerAutomation/components/seerAutomationProjectList';
import {SeerConnectGitHubBanner} from 'getsentry/views/seerAutomation/components/seerConnectGitHubBanner';
import {SeerAutomationSettings} from 'getsentry/views/seerAutomation/settings';

export default function SeerAutomation() {
  const organization = useOrganization();
  const hasSeerCohort =
    organization.features.includes('seat-based-seer-enabled') ||
    organization.features.includes('seer-added') ||
    organization.features.includes('code-review-beta');
  const hasActiveSeerSubscription = organization.features.includes(
    'seat-based-seer-enabled'
  );
  const showNoActiveSeerSubscriptionBanner = hasSeerCohort && !hasActiveSeerSubscription;

  if (showNewSeer(organization)) {
    return (
      <Stack gap="lg">
        {showNoActiveSeerSubscriptionBanner ? <NoActiveSeerSubscriptionBanner /> : null}
        <SeerAutomationSettings />
      </Stack>
    );
  }

  // Show the regular settings page
  return (
    <Fragment>
      <SentryDocumentTitle title={t('Seer Automation')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Seer Automation')}
        subtitle={t(
          "Choose how Seer automatically triages and diagnoses incoming issues, before you even notice them. This analysis is billed at the standard rates for Seer's Issue Scan and Issue Fix."
        )}
      />

      <NoProjectMessage organization={organization}>
        <Stack gap="lg">
          {showNoActiveSeerSubscriptionBanner ? <NoActiveSeerSubscriptionBanner /> : null}
          <SeerConnectGitHubBanner />

          <SeerAutomationProjectList />
          <br />
          <SeerAutomationDefault />
        </Stack>
      </NoProjectMessage>
    </Fragment>
  );
}
