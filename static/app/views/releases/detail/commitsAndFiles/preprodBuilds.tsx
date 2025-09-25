import {Fragment, useContext, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Container, Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconCheckmark, IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import type {ListBuildsApiResponse} from 'sentry/views/preprod/types/listBuildsTypes';
import {
  formattedDownloadSize,
  formattedInstallSize,
  getPlatformIconFromPlatform,
} from 'sentry/views/preprod/utils/labelUtils';
import {ReleaseContext} from 'sentry/views/releases/detail';

export default function PreprodBuilds() {
  const organization = useOrganization();
  const releaseContext = useContext(ReleaseContext);
  const projectSlug = releaseContext.project.slug;

  const params = useParams<{release: string}>();
  const location = useLocation();

  const {query: urlSearchQuery, cursor} = useLocationQuery({
    fields: {
      query: decodeScalar,
      cursor: decodeScalar,
    },
  });

  const [localSearchQuery, setLocalSearchQuery] = useState(urlSearchQuery || '');
  const debouncedLocalSearchQuery = useDebouncedValue(localSearchQuery);

  useEffect(() => {
    setLocalSearchQuery(urlSearchQuery || '');
  }, [urlSearchQuery]);

  useEffect(() => {
    if (debouncedLocalSearchQuery !== (urlSearchQuery || '')) {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          query: debouncedLocalSearchQuery.trim() || undefined,
          cursor: undefined, // Reset pagination when searching
        },
      });
    }
  }, [debouncedLocalSearchQuery, urlSearchQuery, location]);

  const queryParams: Record<string, any> = {
    per_page: 25,
    release_version: params.release,
  };

  if (cursor) {
    queryParams.cursor = cursor;
  }

  if (urlSearchQuery?.trim()) {
    queryParams.query = urlSearchQuery.trim();
  }

  const {
    data: buildsData,
    isPending: isLoadingBuilds,
    error: buildsError,
    refetch,
    getResponseHeader,
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
    setLocalSearchQuery(query);
  };

  const builds = buildsData?.builds || [];
  const pageLinks = getResponseHeader?.('Link') || null;

  const header = (
    <SimpleTable.Header>
      <SimpleTable.HeaderCell>{t('App')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Build')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Install Size')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Download Size')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>
    </SimpleTable.Header>
  );

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <SentryDocumentTitle
          title={t('Preprod Builds - Release %s', formatVersion(params.release))}
          orgSlug={organization.slug}
          projectSlug={projectSlug}
        />
        {buildsError && <LoadingError onRetry={refetch} />}
        <Container paddingBottom="md">
          <SearchBar
            placeholder={t('Search by build, SHA, branch name, or pull request')}
            onChange={handleSearch}
            query={localSearchQuery}
          />
        </Container>
        {isLoadingBuilds ? (
          <SimpleTableWithColumns>
            {header}
            <SimpleTable.Empty>
              <LoadingIndicator />
            </SimpleTable.Empty>
          </SimpleTableWithColumns>
        ) : builds.length ? (
          <Fragment>
            <SimpleTableWithColumns>
              {header}
              {builds.map(build => (
                <SimpleTable.Row key={build.id}>
                  <InteractionStateLayer />
                  <SimpleTable.RowCell justify="flex-start">
                    <FullRowLink
                      to={`/organizations/${organization.slug}/preprod/${projectSlug}/${build.id}`}
                    >
                      <Flex direction="column" gap="xs">
                        <Flex align="center" gap="sm">
                          {build.app_info?.platform && (
                            <PlatformIcon
                              platform={getPlatformIconFromPlatform(
                                build.app_info.platform
                              )}
                            />
                          )}
                          <Text size="lg" bold>
                            {build.app_info?.name || 'Unknown App'}
                          </Text>
                        </Flex>
                        <Text size="sm" variant="muted">
                          {build.app_info?.app_id || 'Unknown ID'}
                        </Text>
                      </Flex>
                    </FullRowLink>
                  </SimpleTable.RowCell>

                  <SimpleTable.RowCell justify="flex-start">
                    <Flex direction="column" gap="xs">
                      <Flex align="center" gap="xs">
                        <Text size="lg" bold>
                          {build.app_info?.version || 'Unknown'}
                        </Text>
                        <Text size="lg" bold>
                          ({build.app_info?.build_number || 'Unknown'})
                        </Text>
                        {build.state === 3 && (
                          <IconCheckmark size="sm" color="green300" />
                        )}
                      </Flex>
                      <Flex align="center" gap="xs">
                        <IconCommit size="xs" />
                        <Text size="sm" variant="muted">
                          #{build.vcs_info?.head_sha?.slice(0, 7) || 'N/A'}
                        </Text>
                        <Text size="sm" variant="muted">
                          -
                        </Text>
                        <Text size="sm" variant="muted">
                          {build.vcs_info?.head_ref || 'main'}
                        </Text>
                      </Flex>
                    </Flex>
                  </SimpleTable.RowCell>

                  <SimpleTable.RowCell>
                    <Text>{formattedInstallSize(build)}</Text>
                  </SimpleTable.RowCell>

                  <SimpleTable.RowCell>
                    <Text>{formattedDownloadSize(build)}</Text>
                  </SimpleTable.RowCell>

                  <SimpleTable.RowCell>
                    {build.app_info?.date_added ? (
                      <TimeSince date={build.app_info.date_added} unitStyle="short" />
                    ) : (
                      '-'
                    )}
                  </SimpleTable.RowCell>
                </SimpleTable.Row>
              ))}
            </SimpleTableWithColumns>
            <Pagination pageLinks={pageLinks} />
          </Fragment>
        ) : (
          <SimpleTableWithColumns>
            {header}
            <SimpleTable.Empty>
              <p>{t('There are no preprod builds associated with this project.')}</p>
            </SimpleTable.Empty>
          </SimpleTableWithColumns>
        )}
      </Layout.Main>
    </Layout.Body>
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  overflow-y: auto;
  grid-template-columns: minmax(max-content, 1fr) repeat(4, max-content);
`;

const FullRowLink = styled(Link)`
  margin: -${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl};

  flex-grow: 1;

  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: -1;
  }
`;
