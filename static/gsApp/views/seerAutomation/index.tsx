import {Fragment} from 'react';

import {Link} from 'sentry/components/core/link';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {DataCategoryExact} from 'sentry/types/core';
import useOrganization from 'sentry/utils/useOrganization';
import {getPricingDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import AiSetupDataConsent from 'getsentry/components/ai/AiSetupDataConsent';

import {SeerAutomationDefault} from './seerAutomationDefault';
import {SeerAutomationProjectList} from './seerAutomationProjectList';

function SeerAutomationRoot() {
  const organization = useOrganization();
  const {isLoading, billing, setupAcknowledgement} = useOrganizationSeerSetup();

  if (
    !organization.features.includes('trigger-autofix-on-issue-summary') ||
    organization.hideAiFeatures
  ) {
    return <NoAccess />;
  }

  // Show loading placeholders while checking setup
  if (isLoading) {
    return (
      <Fragment>
        <SentryDocumentTitle title={t('Seer Automation')} orgSlug={organization.slug} />
        <Placeholder height="60px" />
        <br />
        <Placeholder height="200px" />
        <br />
        <Placeholder height="200px" />
      </Fragment>
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

  // Show the regular settings page
  return (
    <Fragment>
      <SentryDocumentTitle title={t('Seer Automation')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Seer Automation')}
        subtitle={tct(
          "Choose how Seer automatically triages and root-causes incoming issues, before you even notice them. This analysis is billed at the [link:standard rates] for Seer's Issue Scan and Issue Fix. See [spendlink:docs] on how to manage your Seer spend.",
          {
            link: <Link to={'https://docs.sentry.io/pricing/#seer-pricing'} />,
            spendlink: (
              <Link to={getPricingDocsLinkForEventType(DataCategoryExact.SEER_AUTOFIX)} />
            ),
          }
        )}
      />

      <NoProjectMessage organization={organization}>
        <SeerAutomationProjectList />
        <br />
        <SeerAutomationDefault />
      </NoProjectMessage>
    </Fragment>
  );
}

export default SeerAutomationRoot;
