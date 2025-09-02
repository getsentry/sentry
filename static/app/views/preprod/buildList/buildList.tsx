import React, {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconCheckmark, IconChevron, IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {ListBuildsApiResponse} from 'sentry/views/preprod/types/listBuildsTypes';
import {getPlatformIconFromPlatform} from 'sentry/views/preprod/utils/labelUtils';

export default function BuildList() {
  const organization = useOrganization();
  const params = useParams<{projectId: string}>();
  const projectId = params.projectId;
  const [page, setPage] = useState(1);
  const theme = useTheme();

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

  const builds = buildsData?.builds || [];
  const pagination = buildsData?.pagination;
  let tableContent = null;
  if (isLoading) {
    tableContent = <SimpleTable.Empty>{t('Loading builds...')}</SimpleTable.Empty>;
  } else if (error) {
    tableContent = <SimpleTable.Empty>{t(`Error loading builds`)}</SimpleTable.Empty>;
  } else {
    if (builds.length === 0) {
      tableContent = <SimpleTable.Empty>{t('No builds found')}</SimpleTable.Empty>;
    } else {
      tableContent = (
        <React.Fragment>
          {builds.map((build: BuildDetailsApiResponse) => (
            <SimpleTable.Row key={build.id}>
              <Link
                to={`/organizations/${organization.slug}/preprod/${projectId}/${build.id}`}
                style={{
                  display: 'contents',
                  cursor: 'pointer',
                  color: theme.textColor,
                }}
              >
                <InteractionStateLayer />
                <SimpleTable.RowCell justify="flex-start">
                  <BuildInfo>
                    <BuildName>
                      {build.app_info.platform && (
                        <PlatformIcon
                          platform={getPlatformIconFromPlatform(build.app_info.platform)}
                        />
                      )}
                      {build.app_info.name}
                    </BuildName>
                    <BuildDetails>{build.app_info.app_id}</BuildDetails>
                  </BuildInfo>
                </SimpleTable.RowCell>

                <SimpleTable.RowCell justify="flex-start">
                  <BuildInfo>
                    <BuildNumber>
                      {build.app_info.version}
                      <span>({build.app_info.build_number})</span>
                      {build.state === 3 && <IconCheckmark size="sm" color="green300" />}
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
                  {build.app_info.date_added ? (
                    <TimeSince date={build.app_info.date_added} unitStyle="short" />
                  ) : (
                    '-'
                  )}
                </SimpleTable.RowCell>
              </Link>
            </SimpleTable.Row>
          ))}
        </React.Fragment>
      );
    }
  }

  return (
    <SentryDocumentTitle title="Build list">
      <Layout.Page>
        <Layout.Header>
          <Layout.Title>Builds</Layout.Title>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <Flex direction="column" gap="md">
              <SimpleTableWithColumns>
                <SimpleTable.Header>
                  <SimpleTable.HeaderCell>APP</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>BUILD</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>INSTALL SIZE</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>DOWNLOAD SIZE</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>CREATED</SimpleTable.HeaderCell>
                </SimpleTable.Header>

                {tableContent}
              </SimpleTableWithColumns>

              {pagination && (
                <Flex
                  direction="row"
                  gap="md"
                  align="center"
                  justify="end"
                  data-test-id="pagination"
                >
                  <PaginationCaption>
                    Page {pagination.page + 1} of{' '}
                    {Math.ceil(
                      (typeof pagination.total_count === 'number'
                        ? pagination.total_count
                        : 0) / pagination.per_page
                    )}
                  </PaginationCaption>
                  <ButtonBar merged gap="0">
                    <Button
                      icon={<IconChevron direction="left" />}
                      aria-label={t('Previous')}
                      size="sm"
                      disabled={!pagination.has_prev}
                      onClick={() => setPage(pagination.prev || 1)}
                    />
                    <Button
                      icon={<IconChevron direction="right" />}
                      aria-label={t('Next')}
                      size="sm"
                      disabled={!pagination.has_next}
                      onClick={() => {
                        setPage(pagination.next || pagination.page + 1);
                      }}
                    />
                  </ButtonBar>
                </Flex>
              )}
            </Flex>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
`;

const BuildName = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
`;

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
`;

const PaginationCaption = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  margin-right: ${space(2)};
`;
