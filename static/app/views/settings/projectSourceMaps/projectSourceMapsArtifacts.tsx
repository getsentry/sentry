import {Fragment, useCallback} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Role} from 'sentry/components/acl/role';
import {Button} from 'sentry/components/button';
import FileSize from 'sentry/components/fileSize';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelTable from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import Tag from 'sentry/components/tag';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClock, IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Artifact, DebugIdBundleArtifact, Project} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {DebugIdBundleDeleteButton} from 'sentry/views/settings/projectSourceMaps/debugIdBundleDeleteButton';
import {DebugIdBundleDetails} from 'sentry/views/settings/projectSourceMaps/debugIdBundleDetails';
import {useDeleteDebugIdBundle} from 'sentry/views/settings/projectSourceMaps/useDeleteDebugIdBundle';

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
  type,
  orgSlug,
  artifactColumnDetails,
}: {
  artifactColumnDetails: React.ReactNode;
  downloadRole: string;
  downloadUrl: string;
  name: string;
  orgSlug: string;
  size: number;
  type?: string;
}) {
  return (
    <Fragment>
      <ArtifactColumn>
        <Name>{name || `(${t('empty')})`}</Name>
        {artifactColumnDetails}
      </ArtifactColumn>
      {type && <TypeColumn>{type}</TypeColumn>}
      <SizeColumn>
        <FileSize bytes={size} />
      </SizeColumn>
      <ActionsColumn>
        <Role role={downloadRole}>
          {({hasRole}) => {
            return (
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
            );
          }}
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
  const debugIdBundlesArtifactsEndpoint = `/projects/${organization.slug}/${
    project.slug
  }/artifact-bundles/${encodeURIComponent(params.bundleId)}/files/`;

  // debug id bundles tab url
  const debugIdsUrl = normalizeUrl(
    `/settings/${organization.slug}/projects/${project.slug}/source-maps/artifact-bundles/${params.bundleId}/`
  );

  const tabDebugIdBundlesActive = location.pathname === debugIdsUrl;

  const {
    data: artifactsData,
    getResponseHeader: artifactsHeaders,
    isLoading: artifactsLoading,
  } = useApiQuery<Artifact[]>(
    [
      artifactsEndpoint,
      {
        query: {query, cursor},
      },
    ],
    {
      staleTime: 0,
      keepPreviousData: true,
      enabled: !tabDebugIdBundlesActive,
    }
  );

  const {
    data: debugIdBundlesArtifactsData,
    getResponseHeader: debugIdBundlesArtifactsHeaders,
    isLoading: debugIdBundlesArtifactsLoading,
  } = useApiQuery<DebugIdBundleArtifact>(
    [
      debugIdBundlesArtifactsEndpoint,
      {
        query: {query, cursor},
      },
    ],
    {
      staleTime: 0,
      keepPreviousData: true,
      enabled: tabDebugIdBundlesActive,
    }
  );

  const {mutate: deleteDebugIdArtifacts} = useDeleteDebugIdBundle({
    onSuccess: () =>
      router.push(
        `/settings/${organization.slug}/projects/${project.slug}/source-maps/artifact-bundles/`
      ),
  });

  const handleDeleteDebugIdBundle = useCallback(() => {
    if (!debugIdBundlesArtifactsData) {
      return;
    }
    deleteDebugIdArtifacts({
      projectSlug: project.slug,
      bundleId: debugIdBundlesArtifactsData.bundleId,
    });
  }, [debugIdBundlesArtifactsData, deleteDebugIdArtifacts, project.slug]);

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
      <SettingsPageHeader
        title={tabDebugIdBundlesActive ? params.bundleId : t('Release Bundle')}
        action={
          tabDebugIdBundlesActive && (
            <DebugIdBundleDeleteButton size="sm" onDelete={handleDeleteDebugIdBundle} />
          )
        }
        subtitle={
          !tabDebugIdBundlesActive && (
            <VersionAndDetails>{params.bundleId}</VersionAndDetails>
          )
        }
      />
      {tabDebugIdBundlesActive && debugIdBundlesArtifactsData && (
        <DetailsPanel>
          <DebugIdBundleDetails debugIdBundle={debugIdBundlesArtifactsData} />
        </DetailsPanel>
      )}
      <SearchBarWithMarginBottom
        placeholder={
          tabDebugIdBundlesActive ? t('Filter by Path or ID') : t('Filter by Path')
        }
        onSearch={handleSearch}
        query={query}
      />
      <StyledPanelTable
        hasTypeColumn={tabDebugIdBundlesActive}
        headers={[
          t('Artifact'),
          ...(tabDebugIdBundlesActive
            ? [<TypeColumn key="type">{t('Type')}</TypeColumn>]
            : []),
          <SizeColumn key="file-size">{t('File Size')}</SizeColumn>,
          '',
        ]}
        emptyMessage={
          query
            ? t('No artifacts match your search query.')
            : tabDebugIdBundlesActive
            ? t('There are no artifacts in this bundle.')
            : t('There are no artifacts in this archive.')
        }
        isEmpty={
          (tabDebugIdBundlesActive
            ? debugIdBundlesArtifactsData?.files ?? []
            : artifactsData ?? []
          ).length === 0
        }
        isLoading={
          tabDebugIdBundlesActive ? debugIdBundlesArtifactsLoading : artifactsLoading
        }
      >
        {tabDebugIdBundlesActive
          ? (debugIdBundlesArtifactsData?.files ?? []).map(data => {
              const downloadUrl = `${api.baseUrl}/projects/${organization.slug}/${
                project.slug
              }/artifact-bundles/${encodeURIComponent(params.bundleId)}/files/${
                data.id
              }/?download=1`;

              return (
                <ArtifactsTableRow
                  key={data.id}
                  size={data.fileSize}
                  name={data.filePath}
                  type={debugIdBundleTypeLabels[data.fileType]}
                  downloadRole={organization.debugFilesRole}
                  downloadUrl={downloadUrl}
                  orgSlug={organization.slug}
                  artifactColumnDetails={
                    <Fragment>
                      {data.sourcemap ? (
                        <div>
                          <SubText>{t('Sourcemap Reference:')}</SubText> {data.sourcemap}
                        </div>
                      ) : null}
                      {data.debugId ? (
                        <div>
                          <SubText>{t('Debug ID:')}</SubText> {data.debugId}
                        </div>
                      ) : null}
                    </Fragment>
                  }
                />
              );
            })
          : artifactsData?.map(data => {
              const downloadUrl = `${api.baseUrl}/projects/${organization.slug}/${
                project.slug
              }/releases/${encodeURIComponent(params.bundleId)}/files/${
                data.id
              }/?download=1`;

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
            ? debugIdBundlesArtifactsHeaders?.('Link') ?? ''
            : artifactsHeaders?.('Link') ?? ''
        }
      />
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)<{hasTypeColumn: boolean}>`
  grid-template-columns: minmax(220px, 1fr) minmax(120px, max-content) minmax(
      74px,
      max-content
    );
  ${p =>
    p.hasTypeColumn &&
    `
  grid-template-columns:
    minmax(220px, 1fr) minmax(120px, max-content) minmax(120px, max-content)
    minmax(74px, max-content);
    `}
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

const DetailsPanel = styled(Panel)`
  padding: ${space(1)} ${space(2)};
`;

const ArtifactColumn = styled('div')`
  overflow-wrap: break-word;
  word-break: break-all;
  line-height: 140%;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const Name = styled('div')`
  display: flex;
  justify-content: flex-start;
  align-items: center;
`;

const TypeColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  align-items: center;
  color: ${p => p.theme.subText};
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

const SubText = styled('span')`
  color: ${p => p.theme.subText};
`;

const VersionAndDetails = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  word-break: break-word;
`;
