import {Outlet} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ConventionIssueCount} from 'sentry/views/codeConventions/conventionIssueCount';
import {RepositorySelector} from 'sentry/views/codeConventions/repositorySelector';
import {
  CONVENTIONS_CONTENTS_URL,
  formatConventionTitle,
  getCodeConventionsPath,
  REPO,
  YAML_EXTENSION,
} from 'sentry/views/codeConventions/utils';

interface GitHubContentEntry {
  name: string;
  sha: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
}

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: '1fr'},
  {key: 'issues', width: 'max-content'},
];

export default function CodeConventions() {
  const organization = useOrganization();
  const location = useLocation();

  // The repo is public, so the unauthenticated GitHub API is enough here. Its
  // rate limit is per-IP, so avoid refetching on every focus or remount.
  const {
    data: entries,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['github-contents', CONVENTIONS_CONTENTS_URL],
    queryFn: async ({signal}): Promise<GitHubContentEntry[]> => {
      const response = await fetch(CONVENTIONS_CONTENTS_URL, {
        signal,
        headers: {Accept: 'application/vnd.github+json'},
      });
      if (!response.ok) {
        throw new Error(`GitHub responded with ${response.status}`);
      }
      return response.json();
    },
    select: data =>
      data.filter(entry => entry.type === 'file' && YAML_EXTENSION.test(entry.name)),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <SentryDocumentTitle title={t('Code Conventions')} orgSlug={organization.slug}>
      <Stack flex={1}>
        <Layout.Title>{t('Code Conventions')}</Layout.Title>
        <Layout.Body>
          <Layout.Main width="full">
            <Stack gap="xl">
              <Flex>
                <RepositorySelector repoName={REPO} />
              </Flex>
              <SimpleTable
                columns={COLUMNS}
                header={
                  <SimpleTable.HeaderRow>
                    <SimpleTable.HeaderCell>{t('Title')}</SimpleTable.HeaderCell>
                    <SimpleTable.HeaderCell>{t('Issues')}</SimpleTable.HeaderCell>
                  </SimpleTable.HeaderRow>
                }
              >
                {isPending && <SimpleTable.Loading />}
                {isError && <SimpleTable.Error onRetry={refetch} />}
                {entries?.length === 0 && (
                  <SimpleTable.Empty>{t('No YAML files found')}</SimpleTable.Empty>
                )}
                {entries?.map(entry => (
                  <SimpleTable.Row key={entry.sha}>
                    <SimpleTable.RowCell>
                      <Link
                        to={{
                          pathname: normalizeUrl(
                            `${getCodeConventionsPath(organization.slug)}${entry.name}/`
                          ),
                          query: location.query,
                        }}
                      >
                        <strong>{formatConventionTitle(entry.name)}</strong>
                      </Link>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell>
                      <ConventionIssueCount title={formatConventionTitle(entry.name)} />
                    </SimpleTable.RowCell>
                  </SimpleTable.Row>
                ))}
              </SimpleTable>
            </Stack>
          </Layout.Main>
        </Layout.Body>
      </Stack>
      <Outlet />
    </SentryDocumentTitle>
  );
}
