import {Fragment, useCallback} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Role} from 'sentry/components/acl/role';
import {Button} from 'sentry/components/button';
import FileSize from 'sentry/components/fileSize';
import Link from 'sentry/components/links/link';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import Tag from 'sentry/components/tag';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClock, IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Artifact, Project} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type DebugIdBundleArtifact = {
  debugId: string;
  filePath: string;
  fileSize: number;
  fileType: number;
  id: string;
};

enum DebugIdBundleArtifactType {
  INVALID = 0,
  SOURCE = 1,
  MINIFIED_SOURCE = 2,
  SOURCE_MAP = 3,
  INDEXED_RAM_BUNDLE = 4,
}

const debugIdBundleTypeLabels = {
  [DebugIdBundleArtifactType.INVALID]: t('Invalid'),
  [DebugIdBundleArtifactType.SOURCE]: t('Source'),
  [DebugIdBundleArtifactType.MINIFIED_SOURCE]: t('Minified'),
  [DebugIdBundleArtifactType.SOURCE_MAP]: t('Source Map'),
  [DebugIdBundleArtifactType.INDEXED_RAM_BUNDLE]: t('Indexed RAM Bundle'),
};

function ArtifactsTableRow({
  name,
  downloadRole,
  downloadUrl,
  size,
  orgSlug,
  artifactColumnDetails,
}: {
  artifactColumnDetails: React.ReactNode;
  downloadRole: string;
  downloadUrl: string;
  name: string;
  orgSlug: string;
  size: number;
}) {
  return (
    <Fragment>
      <ArtifactColumn>
        <Name>{name || `(${t('empty')})`}</Name>
        {artifactColumnDetails}
      </ArtifactColumn>
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
                  settingsLink: <Link to={`/settings/${orgSlug}/#debugFilesRole`} />,
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
}

type Props = RouteComponentProps<
  {bundleId: string; orgId: string; projectId: string},
  {}
> & {
  project: Project;
};

export function ProjectSourceMapsArtifacts({params, location, router, project}: Props) {
  const api = useApi();
  const organization = useOrganization();

  // query params
  const query = decodeScalar(location.query.query);
  const cursor = location.query.cursor ?? '';

  // endpoints
  const artifactsEndpoint = `/projects/${organization.slug}/${
    project.slug
  }/releases/${encodeURIComponent(params.bundleId)}/files/`;
  const debugIdBundlesEndpoint = ``;

  // tab urls
  const releaseBundlesUrl = normalizeUrl(
    `/settings/${organization.slug}/projects/${project.slug}/source-maps/release-bundles/${params.bundleId}`
  );
  const debugIdsUrl = normalizeUrl(
    `/settings/${organization.slug}/projects/${project.slug}/source-maps/debug-id-bundles/${params.bundleId}`
  );

  const tabDebugIdBundlesActive = location.pathname === debugIdsUrl;

  const {data: artifactsData, isLoading: artifactsLoading} = useQuery<
    [Artifact[], any, any]
  >(
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

  const {data: debugIdBundlesData, isLoading: debugIdBundlesLoading} = useQuery<
    [DebugIdBundleArtifact[], any, any]
  >(
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
      <SettingsPageHeader title={params.bundleId} />
      <NavTabs underlined>
        <ListLink to={releaseBundlesUrl} index isActive={() => !tabDebugIdBundlesActive}>
          {t('Release Bundles')}
        </ListLink>
        <ListLink to={debugIdsUrl} isActive={() => tabDebugIdBundlesActive}>
          {t('Debug ID Bundles')}
        </ListLink>
      </NavTabs>
      <SearchBarWithMarginBottom
        placeholder={
          tabDebugIdBundlesActive ? t('Filter by Path or ID ') : t('Filter by Path')
        }
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
        isEmpty={
          (tabDebugIdBundlesActive
            ? debugIdBundlesData?.[0] ?? []
            : artifactsData?.[0] ?? []
          ).length === 0
        }
        isLoading={tabDebugIdBundlesActive ? debugIdBundlesLoading : artifactsLoading}
      >
        {tabDebugIdBundlesActive
          ? debugIdBundlesData?.[0].map(data => {
              const downloadUrl = `${api.baseUrl}/projects/${organization.slug}/${
                project.slug
              }/releases/${encodeURIComponent(data.debugId)}/files/${
                data.id
              }/?download=1`;

              return (
                <ArtifactsTableRow
                  key={data.id}
                  size={data.fileSize}
                  name={data.filePath}
                  downloadRole={organization.debugFilesRole}
                  downloadUrl={downloadUrl}
                  orgSlug={organization.slug}
                  artifactColumnDetails={
                    <DebugIdAndFileTypeWrapper>
                      <div>{data.debugId}</div>
                      <div>{debugIdBundleTypeLabels[data.fileType]}</div>
                    </DebugIdAndFileTypeWrapper>
                  }
                />
              );
            })
          : artifactsData?.[0].map(data => {
              const downloadUrl = `${api.baseUrl}/projects/${organization.slug}/${
                project.slug
              }/releases/${encodeURIComponent(data.name)}/files/${data.id}/?download=1`;

              return (
                <ArtifactsTableRow
                  key={data.id}
                  size={data.size}
                  name={data.name}
                  downloadRole={organization.debugFilesRole}
                  downloadUrl={downloadUrl}
                  orgSlug={organization.slug}
                  artifactColumnDetails={
                    <TimeAndDistWrapper>
                      <TimeWrapper>
                        <IconClock size="sm" />
                        <TimeSince date={data.dateCreated} />
                      </TimeWrapper>
                      <StyledTag
                        type={data.dist ? 'info' : undefined}
                        tooltipText={data.dist ? undefined : t('No distribution set')}
                      >
                        {data.dist ?? t('none')}
                      </StyledTag>
                    </TimeAndDistWrapper>
                  }
                />
              );
            })}
      </StyledPanelTable>
      <Pagination
        pageLinks={
          tabDebugIdBundlesActive
            ? debugIdBundlesData?.[2]?.getResponseHeader('Link') ?? ''
            : artifactsData?.[2]?.getResponseHeader('Link') ?? ''
        }
      />
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

const ArtifactColumn = styled('div')`
  overflow-wrap: break-word;
  word-break: break-all;
  line-height: 140%;
`;

const Name = styled('div')`
  display: flex;
  justify-content: flex-start;
  align-items: center;
`;

const SizeColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  align-items: center;
  color: ${p => p.theme.subText};
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

const DebugIdAndFileTypeWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;
