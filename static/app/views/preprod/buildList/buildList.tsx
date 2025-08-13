import {useState} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconCheckmark, IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {ListBuildsApiResponse} from 'sentry/views/preprod/types/listBuildsTypes';

export default function BuildList() {
  const organization = useOrganization();
  const params = useParams<{projectId: string}>();
  const projectId = params.projectId;
  const [page, setPage] = useState(1);

  const buildsQuery: UseApiQueryResult<ListBuildsApiResponse, RequestError> =
    useApiQuery<ListBuildsApiResponse>(
      [
        `/projects/${organization.slug}/${projectId}/preprodartifacts/list-builds/`,
        {query: {page, per_page: 25}},
      ],
      {
        staleTime: 0,
        enabled: !!projectId,
      }
    );

  const {data: buildsData, isLoading, error} = buildsQuery;

  if (isLoading) {
    return (
      <SentryDocumentTitle title="Build list">
        <Layout.Page>
          <Layout.Header>
            <Layout.Title>Builds</Layout.Title>
          </Layout.Header>
          <Layout.Body>
            <Layout.Main>
              <div>Loading builds...</div>
            </Layout.Main>
          </Layout.Body>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  if (error) {
    return (
      <SentryDocumentTitle title="Build list">
        <Layout.Page>
          <Layout.Header>
            <Layout.Title>Builds</Layout.Title>
          </Layout.Header>
          <Layout.Body>
            <Layout.Main>
              <div>Error loading builds: {error.message}</div>
            </Layout.Main>
          </Layout.Body>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  const builds = buildsData?.builds || [];
  const pagination = buildsData?.pagination;

  return (
    <SentryDocumentTitle title="Build list">
      <Layout.Page>
        <Layout.Header>
          <Layout.Title>Builds</Layout.Title>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main>
            <SimpleTable>
              <SimpleTable.Header>
                <SimpleTable.HeaderCell sort="desc" handleSortClick={() => {}}>
                  BUILD
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>INSTALL SIZE</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>DOWNLOAD SIZE</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>ISSUES</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>CREATED</SimpleTable.HeaderCell>
              </SimpleTable.Header>

              {builds.length === 0 ? (
                <SimpleTable.Empty>{t('No builds found')}</SimpleTable.Empty>
              ) : (
                builds.map((build: BuildDetailsApiResponse) => (
                  <SimpleTable.Row key={build.app_info.build_number}>
                    <SimpleTable.RowCell justify="flex-start">
                      <BuildInfo>
                        <BuildNumber>
                          {build.app_info.build_number}
                          {build.state === 3 && (
                            <IconCheckmark size="sm" color="green300" />
                          )}
                        </BuildNumber>
                        <BuildDetails>
                          <IconCommit size="xs" />
                          <span>#{build.vcs_info.head_sha?.slice(0, 6) || 'N/A'}</span>
                          <span>-</span>
                          <span>{build.vcs_info.head_ref || 'main'}</span>
                        </BuildDetails>
                      </BuildInfo>
                    </SimpleTable.RowCell>

                    <SimpleTable.RowCell>
                      {build.size_info
                        ? formatBytesBase10(build.size_info.install_size_bytes)
                        : '-'}
                    </SimpleTable.RowCell>

                    <SimpleTable.RowCell>
                      {build.size_info
                        ? formatBytesBase10(build.size_info.download_size_bytes)
                        : '-'}
                    </SimpleTable.RowCell>

                    <SimpleTable.RowCell>
                      {/* Placeholder for issues count - would need to be added to the API */}
                      <span style={{color: '#6b5ca6'}}>0</span>
                    </SimpleTable.RowCell>

                    <SimpleTable.RowCell>
                      {build.app_info.date_added ? (
                        <TimeSince date={build.app_info.date_added} unitStyle="short" />
                      ) : (
                        '-'
                      )}
                    </SimpleTable.RowCell>
                  </SimpleTable.Row>
                ))
              )}
            </SimpleTable>

            {pagination && (
              <PaginationContainer>
                <PaginationButton
                  onClick={() => setPage(pagination.prev || 1)}
                  disabled={!pagination.has_prev}
                >
                  Previous
                </PaginationButton>
                <PageInfo>
                  Page {pagination.page} of{' '}
                  {Math.ceil(
                    (typeof pagination.total_count === 'number'
                      ? pagination.total_count
                      : 0) / pagination.per_page
                  )}
                </PageInfo>
                <PaginationButton
                  onClick={() => setPage(pagination.next || pagination.page + 1)}
                  disabled={!pagination.has_next}
                >
                  Next
                </PaginationButton>
              </PaginationContainer>
            )}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const BuildInfo = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
`;

const BuildNumber = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
`;

const BuildDetails = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};

  span:nth-child(2) {
    color: #6b5ca6;
    font-family: monospace;
  }

  span:nth-child(4) {
    color: #6b5ca6;
  }
`;

const PaginationContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${p => p.theme.space.md};
  margin-top: ${p => p.theme.space.lg};
  padding: ${p => p.theme.space.md};
`;

const PaginationButton = styled('button')`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;
  font-size: ${p => p.theme.fontSize.sm};

  &:hover:not(:disabled) {
    background: ${p => p.theme.backgroundSecondary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PageInfo = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;
