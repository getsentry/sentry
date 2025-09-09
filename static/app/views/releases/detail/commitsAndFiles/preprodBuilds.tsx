import {Fragment, useContext, useEffect, useRef, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Container, Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconCheckmark, IconChevron, IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import routeTitleGen from 'sentry/utils/routeTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {ListBuildsApiResponse} from 'sentry/views/preprod/types/listBuildsTypes';
import {getPlatformIconFromPlatform} from 'sentry/views/preprod/utils/labelUtils';
import {ReleaseContext} from 'sentry/views/releases/detail';

import {EmptyState} from './emptyState';

interface PreprodBuildsProps {
  organization: Organization;
  projectSlug: Project['slug'];
}

function PreprodBuildsList({organization, projectSlug}: PreprodBuildsProps) {
  const params = useParams<{release: string}>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    searchParams.get('search') || ''
  );
  const theme = useTheme();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const urlSearchQuery = searchParams.get('search') || '';
    setSearchQuery(urlSearchQuery);
    setDebouncedSearchQuery(urlSearchQuery);
  }, [searchParams]);

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);

      const newSearchParams = new URLSearchParams(searchParams);
      if (searchQuery.trim()) {
        newSearchParams.set('search', searchQuery.trim());
      } else {
        newSearchParams.delete('search');
      }
      setSearchParams(newSearchParams);
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery, searchParams, setSearchParams]);

  const queryParams: Record<string, any> = {
    page,
    per_page: 25,
    release_version: params.release,
  };

  if (debouncedSearchQuery.trim()) {
    queryParams.search = debouncedSearchQuery.trim();
  }

  const {
    data: buildsData,
    isPending: isLoadingBuilds,
    error: buildsError,
    refetch,
  }: UseApiQueryResult<
    ListBuildsApiResponse,
    RequestError
  > = useApiQuery<ListBuildsApiResponse>(
    [
      `/projects/${organization.slug}/${projectSlug}/preprodartifacts/list-builds/`,
      {query: queryParams},
    ],
    {
      staleTime: 0,
      enabled: !!projectSlug && !!params.release,
    }
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const builds = buildsData?.builds || [];
  const pagination = buildsData?.pagination;

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <SentryDocumentTitle
          title={routeTitleGen(
            t('Preprod Builds - Release %s', formatVersion(params.release)),
            organization.slug,
            false,
            projectSlug
          )}
        />
        {buildsError && <LoadingError onRetry={refetch} />}
        <Container paddingBottom="md">
          <SearchBar
            placeholder={t('Search by build, SHA, branch name, or pull request')}
            onChange={handleSearch}
            query={searchQuery}
          />
        </Container>
        {isLoadingBuilds ? (
          <LoadingIndicator />
        ) : builds.length ? (
          <Fragment>
            <Panel>
              <PanelBody>
                <SimpleTableWithColumns>
                  <SimpleTable.Header>
                    <SimpleTable.HeaderCell>{t('APP')}</SimpleTable.HeaderCell>
                    <SimpleTable.HeaderCell>{t('BUILD')}</SimpleTable.HeaderCell>
                    <SimpleTable.HeaderCell>{t('INSTALL SIZE')}</SimpleTable.HeaderCell>
                    <SimpleTable.HeaderCell>{t('DOWNLOAD SIZE')}</SimpleTable.HeaderCell>
                    <SimpleTable.HeaderCell>{t('CREATED')}</SimpleTable.HeaderCell>
                  </SimpleTable.Header>
                  {builds.map((build: BuildDetailsApiResponse) => (
                    <SimpleTable.Row key={build.id}>
                      <Link
                        to={`/organizations/${organization.slug}/preprod/${projectSlug}/${build.id}`}
                        style={{
                          display: 'contents',
                          cursor: 'pointer',
                          color: theme.textColor,
                        }}
                      >
                        <InteractionStateLayer />
                        <SimpleTable.RowCell justify="flex-start">
                          <Flex direction="column" gap="xs">
                            <Flex align="center" gap="sm">
                              {build.app_info.platform && (
                                <PlatformIcon
                                  platform={getPlatformIconFromPlatform(
                                    build.app_info.platform
                                  )}
                                />
                              )}
                              <Text size="lg" bold>
                                {build.app_info.name}
                              </Text>
                            </Flex>
                            <Text size="sm" variant="muted">
                              {build.app_info.app_id}
                            </Text>
                          </Flex>
                        </SimpleTable.RowCell>

                        <SimpleTable.RowCell justify="flex-start">
                          <Flex direction="column" gap="xs">
                            <Flex align="center" gap="xs">
                              <Text size="lg" bold>
                                {build.app_info.version}
                              </Text>
                              <Text size="lg" bold>
                                ({build.app_info.build_number})
                              </Text>
                              {build.state === 3 && (
                                <IconCheckmark size="sm" color="green300" />
                              )}
                            </Flex>
                            <Flex align="center" gap="xs">
                              <IconCommit size="xs" />
                              <Text size="sm" variant="muted">
                                #{build.vcs_info.head_sha?.slice(0, 6) || 'N/A'}
                              </Text>
                              <Text size="sm" variant="muted">
                                -
                              </Text>
                              <Text size="sm" variant="muted">
                                {build.vcs_info.head_ref || 'main'}
                              </Text>
                            </Flex>
                          </Flex>
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
                            <TimeSince
                              date={build.app_info.date_added}
                              unitStyle="short"
                            />
                          ) : (
                            '-'
                          )}
                        </SimpleTable.RowCell>
                      </Link>
                    </SimpleTable.Row>
                  ))}
                </SimpleTableWithColumns>
              </PanelBody>
            </Panel>
            {pagination && (
              <Flex direction="row" gap="md" align="center" justify="end" paddingTop="md">
                <Text variant="muted" size="md">
                  {t(
                    'Page %s of %s',
                    pagination.page + 1,
                    Math.ceil(
                      (typeof pagination.total_count === 'number'
                        ? pagination.total_count
                        : 0) / pagination.per_page
                    )
                  )}
                </Text>
                <ButtonBar merged gap="0">
                  <Button
                    icon={<IconChevron direction="left" />}
                    aria-label={t('Previous')}
                    size="sm"
                    disabled={!pagination.has_prev}
                    onClick={() => setPage((pagination.prev || 0) + 1)}
                  />
                  <Button
                    icon={<IconChevron direction="right" />}
                    aria-label={t('Next')}
                    size="sm"
                    disabled={!pagination.has_next}
                    onClick={() => {
                      setPage((pagination.next || pagination.page + 1) + 1);
                    }}
                  />
                </ButtonBar>
              </Flex>
            )}
          </Fragment>
        ) : (
          <EmptyState>
            {t('There are no preprod builds associated with this project.')}
          </EmptyState>
        )}
      </Layout.Main>
    </Layout.Body>
  );
}

function PreprodBuilds() {
  const organization = useOrganization();
  const releaseContext = useContext(ReleaseContext);

  return (
    <PreprodBuildsList
      organization={organization}
      projectSlug={releaseContext.project.slug}
    />
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
`;

export default PreprodBuilds;
