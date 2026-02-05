import {Fragment} from 'react';
import {parseAsStringEnum, useQueryState} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import ExternalLink from 'sentry/components/links/externalLink';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {DataCategoryExact} from 'sentry/types/core';
import showNewSeer from 'sentry/utils/seer/showNewSeer';
import useOrganization from 'sentry/utils/useOrganization';
import {getPricingDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SeerRepoTable from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTable';
import {SeerAutomationDefault} from 'getsentry/views/seerAutomation/components/seerAutomationDefault';
import {SeerAutomationProjectList} from 'getsentry/views/seerAutomation/components/seerAutomationProjectList';
import SeerConnectGitHubBanner from 'getsentry/views/seerAutomation/components/seerConnectGitHubBanner';
import SeerAutomationSettings from 'getsentry/views/seerAutomation/settings';

export default function SeerAutomation() {
  const organization = useOrganization();

  const [tab, setTab] = useQueryState<'settings' | 'repos'>(
    'tab',
    parseAsStringEnum(['settings', 'repos']).withDefault('settings')
  );

  if (showNewSeer(organization)) {
    return <SeerAutomationSettings />;
  }

  // Show the regular settings page
  return (
    <Fragment>
      <SentryDocumentTitle title={t('Seer Automation')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Seer Automation')}
        subtitle={tct(
          "Choose how Seer automatically triages and diagnoses incoming issues, before you even notice them. This analysis is billed at the [link:standard rates] for Seer's Issue Scan and Issue Fix. See [spendlink:docs] on how to manage your Seer spend.",
          {
            link: <ExternalLink href="https://docs.sentry.io/pricing/#seer-pricing" />,
            spendlink: (
              <ExternalLink
                href={getPricingDocsLinkForEventType(DataCategoryExact.SEER_AUTOFIX)}
              />
            ),
          }
        )}
        action={
          <LinkButton
            href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities"
            external
          >
            {t('Read the docs')}
          </LinkButton>
        }
      />

      <NoProjectMessage organization={organization}>
        <Stack gap="lg">
          <SeerConnectGitHubBanner />
          <Container borderBottom="primary">
            <Tabs value={tab} onChange={setTab}>
              <TabList>
                <TabList.Item key="settings">{t('Settings')}</TabList.Item>
                <TabList.Item key="repos">{t('Repos')}</TabList.Item>
              </TabList>
            </Tabs>
          </Container>
          {tab === 'repos' ? <SeerRepoTable /> : null}
          {tab === 'settings' ? (
            <Fragment>
              <SeerAutomationProjectList />
              <br />
              <SeerAutomationDefault />
            </Fragment>
          ) : null}
        </Stack>
      </NoProjectMessage>
    </Fragment>
  );
}
