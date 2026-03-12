import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {ScmIntegrationTree} from 'sentry/components/repositories/scmIntegrationTree/scmIntegrationTree';
import {ScmTreeFilters} from 'sentry/components/repositories/scmIntegrationTree/scmTreeFilters';
import useScmTreeFilters from 'sentry/components/repositories/scmIntegrationTree/useScmTreeFilters';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

export default function OrganizationRepositories() {
  const organization = useOrganization();
  const {repoFilter, setRepoFilter, searchTerm, setSearchTerm} = useScmTreeFilters();

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
          <ScmTreeFilters
            repoFilter={repoFilter}
            setRepoFilter={setRepoFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
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
