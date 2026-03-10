import {parseAsString, parseAsStringLiteral, useQueryState} from 'nuqs';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {ScmIntegrationTree} from 'sentry/components/repositories/scmIntegrationTree/scmIntegrationTree';
import type {RepoFilter} from 'sentry/components/repositories/scmIntegrationTree/types';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const REPO_FILTER_OPTIONS: Array<SelectOption<RepoFilter>> = [
  {value: 'all' as const, label: t('All repos')},
  {value: 'connected' as const, label: t('Connected Repos')},
  {value: 'not-connected' as const, label: t('Disconnected Repos')},
];

const repoParser = parseAsStringLiteral(
  REPO_FILTER_OPTIONS.map(option => option.value)
).withDefault('all');

export default function OrganizationRepositories() {
  const organization = useOrganization();

  const [searchTerm, setSearchTerm] = useQueryState(
    'search',
    parseAsString.withDefault('')
  );
  const [repoFilter, setRepoFilter] = useQueryState('repo', repoParser);

  return (
    <AnalyticsArea name="repositories">
      <SentryDocumentTitle title={t('Repositories')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Repositories')}
        subtitle={tct(
          `Integrate with a [scm:Source Code Management] provider and then connect repositories with Sentry. Connecting a repo to a project enables [suspect_commits:Suspect Commits] on issues, [suggested_assignees:Suggested Assignees] based on code owners, the ability to mark an issue [resolved_via_commit:Resolved via Commit or PR], and is a requirement for [seer:Seer].`,
          {
            scm: (
              <ExternalLink href="https://docs.sentry.io/organization/getting-started/#source-code-management" />
            ),
            suspect_commits: (
              <ExternalLink href="https://docs.sentry.io/product/issues/suspect-commits/" />
            ),
            suggested_assignees: (
              <ExternalLink href="https://docs.sentry.io/product/issues/ownership-rules/#code-owners" />
            ),
            resolved_via_commit: (
              <ExternalLink href="https://docs.sentry.io/product/releases/associate-commits/#associate-commits-with-a-release" />
            ),
            seer: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities" />
            ),
          }
        )}
      />
      <Stack gap="lg">
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
          providerFilter="all"
          repoFilter={repoFilter}
          search={searchTerm}
        />
      </Stack>
    </AnalyticsArea>
  );
}
