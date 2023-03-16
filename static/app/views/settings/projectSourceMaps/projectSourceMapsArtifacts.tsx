import {Fragment, useCallback} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Role} from 'sentry/components/acl/role';
import {Button} from 'sentry/components/button';
import FileSize from 'sentry/components/fileSize';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import Tag from 'sentry/components/tag';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClock, IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type Props = RouteComponentProps<{bundleId: string}, {}> & {
  project: Project;
  tab: 'release' | 'debug-id';
};

export function ProjectSourceMapsArtifacts({
  params,
  location,
  router,
  project,
  tab,
}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const tabDebugIdBundlesActive = tab === 'debug-id';
  const query = decodeScalar(location.query.query);
  const cursor = location.query.cursor ?? '';
  const downloadRole = organization.debugFilesRole;
  const artifactsEndpoint = `/projects/${organization.slug}/${
    project.slug
  }/releases/${encodeURIComponent(params.bundleId)}/files/`;
  const debugIdBundlesEndpoint = ``;

  const {data: artifactsData, isLoading: artifactsLoading} = useQuery(
    [
      artifactsEndpoint,
      {
        query: {query, cursor},
      },
    ],
    () => {
      return api.requestPromise(artifactsEndpoint, {
        query: {query, cursor},
        includeAllArgs: true,
      });
    },
    {
      staleTime: 0,
      keepPreviousData: true,
      enabled: !tabDebugIdBundlesActive,
    }
  );

  const {data: debugIdBundlesData, isLoading: debugIdBundlesLoading} = useQuery(
    [
      debugIdBundlesEndpoint,
      {
        query: {query, cursor},
      },
    ],
    () => {
      return api.requestPromise(debugIdBundlesEndpoint, {
        query: {query, cursor},
        includeAllArgs: true,
      });
    },
    {
      staleTime: 0,
      keepPreviousData: true,
      enabled: tabDebugIdBundlesActive,
    }
  );

  const data = tabDebugIdBundlesActive
    ? debugIdBundlesData?.[0] ?? []
    : artifactsData?.[0] ?? [];
  const pageLinks = tabDebugIdBundlesActive
    ? debugIdBundlesData?.[2]?.getResponseHeader('Link') ?? ''
    : artifactsData?.[2]?.getResponseHeader('Link') ?? '';
  const loading = tabDebugIdBundlesActive ? debugIdBundlesLoading : artifactsLoading;

  const handleSearch = useCallback(
    (newQuery: string) => {
      router.push({
        ...location,
        query: {...location.query, cursor: undefined, query: newQuery},
      });
    },
    [router, location]
  );

  return (
    <Fragment>
      <SearchBarWithMarginBottom
        placeholder={t('Search')}
        onSearch={handleSearch}
        query={query}
      />
      <StyledPanelTable
        headers={[
          t('Artifact'),
          <SizeColumn key="file-size">{t('File Size')}</SizeColumn>,
          '',
        ]}
        emptyMessage={
          query
            ? t('No artifacts match your search query.')
            : t('There are no artifacts in this archive.')
        }
        isEmpty={data.length === 0}
        isLoading={loading}
      >
        {data.map(({id, size, name, dist, dateCreated}) => {
          const downloadUrl = `${api.baseUrl}/projects/${organization.slug}/${
            project.slug
          }/releases/${encodeURIComponent(name)}/files/${id}/?download=1`;

          return (
            <Fragment key={id}>
              <NameColumn>
                <Name>{name || `(${t('empty')})`}</Name>
                <TimeAndDistWrapper>
                  <TimeWrapper>
                    <IconClock size="sm" />
                    <TimeSince date={dateCreated} />
                  </TimeWrapper>
                  <StyledTag
                    type={dist ? 'info' : undefined}
                    tooltipText={dist ? undefined : t('No distribution set')}
                  >
                    {dist ?? t('none')}
                  </StyledTag>
                </TimeAndDistWrapper>
              </NameColumn>
              <SizeColumn>
                <FileSize bytes={size} />
              </SizeColumn>
              <ActionsColumn>
                <Role role={downloadRole}>
                  {({hasRole}) => (
                    <Tooltip
                      title={tct(
                        'Artifacts can only be downloaded by users with organization [downloadRole] role[orHigher]. This can be changed in [settingsLink:Debug Files Access] settings.',
                        {
                          downloadRole,
                          orHigher: downloadRole !== 'owner' ? ` ${t('or higher')}` : '',
                          settingsLink: (
                            <Link to={`/settings/${organization.slug}/#debugFilesRole`} />
                          ),
                        }
                      )}
                      disabled={hasRole}
                      isHoverable
                    >
                      <Button
                        size="sm"
                        icon={<IconDownload size="sm" />}
                        disabled={!hasRole}
                        href={downloadUrl}
                        title={hasRole ? t('Download Artifact') : undefined}
                        aria-label={t('Download Artifact')}
                      />
                    </Tooltip>
                  )}
                </Role>
              </ActionsColumn>
            </Fragment>
          );
        })}
      </StyledPanelTable>
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: minmax(220px, 1fr) minmax(120px, max-content) minmax(
      74px,
      max-content
    );
`;

const Column = styled('div')`
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const ActionsColumn = styled(Column)`
  justify-content: flex-end;
`;

const SearchBarWithMarginBottom = styled(SearchBar)`
  margin-bottom: ${space(3)};
`;

const SizeColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  align-items: center;
`;

const Name = styled('div')`
  padding-right: ${space(4)};
  overflow-wrap: break-word;
  word-break: break-all;
`;

const TimeAndDistWrapper = styled('div')`
  width: 100%;
  display: flex;
  margin-top: ${space(1)};
  align-items: center;
`;

const TimeWrapper = styled('div')`
  display: grid;
  gap: ${space(0.5)};
  grid-template-columns: min-content 1fr;
  font-size: ${p => p.theme.fontSizeMedium};
  align-items: center;
  color: ${p => p.theme.subText};
`;

const StyledTag = styled(Tag)`
  margin-left: ${space(1)};
`;

const NameColumn = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
`;
