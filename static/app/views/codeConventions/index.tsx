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
import {ConventionTags} from 'sentry/views/codeConventions/conventionTags';
import {ConventionTrend} from 'sentry/views/codeConventions/conventionTrend';
import {RepositorySelector} from 'sentry/views/codeConventions/repositorySelector';
import {
  conventionFilesQueryOptions,
  formatConventionTitle,
  getCodeConventionsPath,
  getConventionIssueTitlePrefix,
  getConventionName,
  REPO,
} from 'sentry/views/codeConventions/utils';

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: '1fr'},
  {key: 'trend', width: '180px'},
  {key: 'issues', width: 'max-content'},
];

export default function CodeQuality() {
  const organization = useOrganization();
  const location = useLocation();

  const {
    data: entries,
    isPending,
    isError,
    refetch,
  } = useQuery(conventionFilesQueryOptions);

  return (
    <SentryDocumentTitle title={t('Code Quality')} orgSlug={organization.slug}>
      <Stack flex={1}>
        <Layout.Title>{t('Code Quality')}</Layout.Title>
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
                    <SimpleTable.HeaderCell>{t('Open (30d)')}</SimpleTable.HeaderCell>
                    <SimpleTable.HeaderCell>{t('Issues')}</SimpleTable.HeaderCell>
                  </SimpleTable.HeaderRow>
                }
              >
                {isPending && <SimpleTable.Loading />}
                {isError && <SimpleTable.Error onRetry={refetch} />}
                {entries?.length === 0 && (
                  <SimpleTable.Empty>{t('No YAML files found')}</SimpleTable.Empty>
                )}
                {entries?.map(entry => {
                  const conventionName = getConventionName(entry.name);
                  return (
                    <SimpleTable.Row key={entry.sha}>
                      <SimpleTable.RowCell>
                        <Stack gap="sm">
                          <Link
                            to={{
                              pathname: normalizeUrl(
                                `${getCodeConventionsPath(organization.slug)}${conventionName}/`
                              ),
                              query: location.query,
                            }}
                          >
                            <strong>{formatConventionTitle(conventionName)}</strong>
                          </Link>
                          <ConventionTags filename={entry.name} />
                        </Stack>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <ConventionTrend
                          titlePrefix={getConventionIssueTitlePrefix(conventionName)}
                        />
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <ConventionIssueCount
                          titlePrefix={getConventionIssueTitlePrefix(conventionName)}
                        />
                      </SimpleTable.RowCell>
                    </SimpleTable.Row>
                  );
                })}
              </SimpleTable>
            </Stack>
          </Layout.Main>
        </Layout.Body>
      </Stack>
      <Outlet />
    </SentryDocumentTitle>
  );
}
