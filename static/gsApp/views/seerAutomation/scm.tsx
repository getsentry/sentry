import {parseAsString, parseAsStringLiteral, useQueryState} from 'nuqs';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {t, tct} from 'sentry/locale';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {ScmIntegrationTree} from 'getsentry/views/seerAutomation/components/scmIntegrationTree/scmIntegrationTree';
import SeerSettingsPageContent from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import type {ProviderFilter, RepoFilter} from 'getsentry/views/seerAutomation/types';

const REPO_FILTER_OPTIONS: Array<SelectOption<RepoFilter>> = [
  {value: 'all' as const, label: t('All repos')},
  {value: 'connected' as const, label: t('Connected Repos')},
  {value: 'not-connected' as const, label: t('Disconnected Repos')},
];

const PROVIDER_FILTER_OPTIONS: Array<SelectOption<ProviderFilter>> = [
  {value: 'seer-supported' as const, label: t('Supported by Seer')},
  {value: 'all' as const, label: t('All providers')},
];

const providerParser = parseAsStringLiteral(
  PROVIDER_FILTER_OPTIONS.map(option => option.value)
).withDefault('seer-supported');
const repoParser = parseAsStringLiteral(
  REPO_FILTER_OPTIONS.map(option => option.value)
).withDefault('all');

export default function SeerAutomationSCM() {
  const [searchTerm, setSearchTerm] = useQueryState(
    'search',
    parseAsString.withDefault('')
  );
  const [providerFilter, setProviderFilter] = useQueryState('provider', providerParser);
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
              value={providerFilter}
              onChange={(opt: SelectOption<ProviderFilter>) =>
                setProviderFilter(opt.value)
              }
              options={PROVIDER_FILTER_OPTIONS}
            />
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
            providerFilter={providerFilter}
            repoFilter={repoFilter}
            search={searchTerm}
          />
        </SeerSettingsPageContent>
      </SeerSettingsPageWrapper>
    </AnalyticsArea>
  );
}
