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
import {SettingsPageTabs} from 'getsentry/views/seerAutomation/components/settingsPageTabs';
import {SeerAutomationSettings} from 'getsentry/views/seerAutomation/settings';

export default function SeerAutomation() {
  const organization = useOrganization();

  const hasLegacySeer = organization.features.includes('seer-added');
  const hasCodeReviewBeta = organization.features.includes('code-review-beta');

  if (showNewSeer(organization)) {
    return <SeerAutomationSettings />;
  }

  // Legacy cohorts continue to use the old automation page.
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
          {hasLegacySeer || hasCodeReviewBeta ? <NoActiveSeerSubscriptionBanner /> : null}
          <SettingsPageTabs />
          <SeerConnectGitHubBanner />
          <SeerAutomationProjectList />
          <br />
          <SeerAutomationDefault />
        </Stack>
      </NoProjectMessage>
    </Fragment>
  );
}
