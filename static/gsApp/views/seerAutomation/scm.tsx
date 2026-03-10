import {parseAsString, parseAsStringLiteral, useQueryState} from 'nuqs';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {ScmIntegrationTree} from 'sentry/components/repositories/scmIntegrationTree/scmIntegrationTree';
import type {RepoFilter} from 'sentry/components/repositories/scmIntegrationTree/types';
import {t, tct} from 'sentry/locale';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SeerSettingsPageContent from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

const REPO_FILTER_OPTIONS: Array<SelectOption<RepoFilter>> = [
  {value: 'all' as const, label: t('All repos')},
  {value: 'connected' as const, label: t('Connected Repos')},
  {value: 'not-connected' as const, label: t('Disconnected Repos')},
];

const repoParser = parseAsStringLiteral(
  REPO_FILTER_OPTIONS.map(option => option.value)
).withDefault('all');

export default function SeerAutomationSCM() {
  const [searchTerm, setSearchTerm] = useQueryState(
    'search',
    parseAsString.withDefault('')
  );
  const [repoFilter, setRepoFilter] = useQueryState('repo', repoParser);

  return (
    <AnalyticsArea name="scm">
      <SeerSettingsPageWrapper>
        <SettingsPageHeader
          title={t('Seer SCM Config')}
          subtitle={tct(
            `Install an SCM Integration to connect your source code to Seer. Seer needs read access to your source code to perform code review, and analyze your issues. [read_the_docs:Read the docs] and our [privacy:AI Privacy Principles] to learn more.`,
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
            <CompactSelect
              value={repoFilter}
              onChange={(opt: SelectOption<RepoFilter>) => setRepoFilter(opt.value)}
              options={REPO_FILTER_OPTIONS}
            />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t('Search repos\u2026')}
              style={{flex: 1}}
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
