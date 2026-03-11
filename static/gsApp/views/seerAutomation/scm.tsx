import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {ScmIntegrationTree} from 'sentry/components/repositories/scmIntegrationTree/scmIntegrationTree';
import ScmTreeFilters from 'sentry/components/repositories/scmIntegrationTree/scmTreeFilters';
import useScmTreeFilters from 'sentry/components/repositories/scmIntegrationTree/useScmTreeFilters';
import {t, tct} from 'sentry/locale';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SeerSettingsPageContent from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

export default function SeerAutomationSCM() {
  const {repoFilter, setRepoFilter, searchTerm, setSearchTerm} = useScmTreeFilters();

  return (
    <AnalyticsArea name="scm">
      <SeerSettingsPageWrapper>
        <SettingsPageHeader
          title={t('Seer SCM Config')}
          subtitle={tct(
            `Integrate with a Seer compatible Source Code Management provider and then connect repositories with Sentry. Seer needs read access to your source code to perform code review, and analyze your issues. [read_the_docs:Read the docs] and our [privacy:AI Privacy Principles] to learn more.`,
            {
              privacy: (
                <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/ai-privacy-and-security/" />
              ),
              read_the_docs: (
                <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities" />
              ),
            }
          )}
        />
        <SeerSettingsPageContent>
          <Flex align="center" gap="md">
            <ScmTreeFilters
              repoFilter={repoFilter}
              setRepoFilter={setRepoFilter}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          </Flex>
          <ScmIntegrationTree
            providerFilter="seer-supported"
            repoFilter={repoFilter}
            search={searchTerm}
          />
        </SeerSettingsPageContent>
      </SeerSettingsPageWrapper>
    </AnalyticsArea>
  );
}
