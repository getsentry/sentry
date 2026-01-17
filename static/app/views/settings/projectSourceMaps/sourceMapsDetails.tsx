import {Fragment, useCallback, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {useRole} from 'sentry/components/acl/useRole';
import {Tag} from 'sentry/components/core/badge/tag';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import FileSize from 'sentry/components/fileSize';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import TimeSince from 'sentry/components/timeSince';
import {IconClock, IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import type {Artifact, Release} from 'sentry/types/release';
import type {DebugIdBundleArtifact} from 'sentry/types/sourceMaps';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {isUUID} from 'sentry/utils/string/isUUID';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
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
  downloadUrl,
  size,
  type,
  orgSlug,
  artifactColumnDetails,
}: {
  artifactColumnDetails: React.ReactNode;
  downloadUrl: string;
  name: string;
  orgSlug: string;
  size: number;
  type?: string;
}) {
  const {hasRole, roleRequired: downloadRole} = useRole({role: 'debugFilesRole'});

  return (
    <Fragment>
      <ArtifactColumn>
        <Flex justify="start" align="center">
          {name || `(${t('empty')})`}
        </Flex>
        {artifactColumnDetails}
      </ArtifactColumn>
      {type && <TypeColumn>{type}</TypeColumn>}
      <SizeColumn>
        <FileSize bytes={size} />
      </SizeColumn>
      <ActionsColumn>
        <Tooltip
          title={tct(
            'Artifacts can only be downloaded by users with organization [downloadRole] role[orHigher]. This can be changed in [settingsLink:Debug Files Access] settings.',
            {
              downloadRole,
              orHigher: downloadRole === 'owner' ? '' : ` ${t('or higher')}`,
              settingsLink: <Link to={`/settings/${orgSlug}/#debugFilesRole`} />,
            }
          )}
          disabled={hasRole}
          isHoverable
        >
          <LinkButton
            size="sm"
            icon={<IconDownload size="sm" />}
            disabled={!hasRole}
            href={downloadUrl}
            title={hasRole ? t('Download Artifact') : undefined}
            aria-label={t('Download Artifact')}
          />
        </Tooltip>
      </ActionsColumn>
    </Fragment>
  );
}

type Props = {
  bundleId: string;
  project: Project;
};

export function SourceMapsDetails({bundleId, project}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  // query params
  const query = decodeScalar(location.query.query);
  const cursor = decodeScalar(location.query.cursor);

  // endpoints
  const artifactsEndpoint = `/projects/${organization.slug}/${
    project.slug
  }/releases/${encodeURIComponent(bundleId)}/files/`;
  const debugIdBundlesArtifactsEndpoint = `/projects/${organization.slug}/${
    project.slug
  }/artifact-bundles/${encodeURIComponent(bundleId)}/files/`;

  const isDebugIdBundle = isUUID(bundleId);

  const {
    data: artifactsData,
    getResponseHeader: artifactsHeaders,
    isPending: artifactsLoading,
  } = useApiQuery<Artifact[]>(
    [
      artifactsEndpoint,
      {
        query: {query, cursor},
      },
    ],
    {
      staleTime: 0,
      placeholderData: keepPreviousData,
      enabled: !isDebugIdBundle,
    }
  );

  const {
    data: debugIdBundlesArtifacts,
    getResponseHeader: debugIdBundlesArtifactsHeaders,
    isPending: debugIdBundlesArtifactsLoading,
  } = useApiQuery<DebugIdBundleArtifact>(
    [
      debugIdBundlesArtifactsEndpoint,
      {
        query: {query, cursor},
      },
    ],
    {
      staleTime: 0,
      placeholderData: keepPreviousData,
      enabled: isDebugIdBundle,
    }
  );

  const releaseVersions = debugIdBundlesArtifacts?.associations.map(
    association => `"${association.release}"`
  );

  const {data: releasesData, isPending: releasesLoading} = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          project: [project.id],
          query: `release:[${releaseVersions?.join(',')}]`,
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: false,
      enabled: !!releaseVersions?.length,
    }
  );

  const debugIdBundlesArtifactsData = useMemo(() => {
    if (releasesLoading) {
      return debugIdBundlesArtifacts;
    }

    if (!debugIdBundlesArtifacts) {
      return undefined;
    }

    const existingReleaseNames = new Set((releasesData ?? []).map(r => r.version));

    return {
      ...debugIdBundlesArtifacts,
      associations: debugIdBundlesArtifacts.associations.map(association => ({
        ...association,
        exists: existingReleaseNames.has(association.release),
      })),
    };
  }, [releasesLoading, releasesData, debugIdBundlesArtifacts]);

  const {mutate: deleteDebugIdArtifacts} = useDeleteDebugIdBundle({
    onSuccess: () =>
      navigate(`/settings/${organization.slug}/projects/${project.slug}/source-maps/`),
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
      navigate({
        ...location,
        query: {...location.query, cursor: undefined, query: newQuery},
      });
    },
    [navigate, location]
  );

  return (
    <Fragment>
      <SettingsPageHeader
        title={isDebugIdBundle ? bundleId : t('Release Bundle')}
        action={
          isDebugIdBundle && (
            <DebugIdBundleDeleteButton size="sm" onDelete={handleDeleteDebugIdBundle} />
          )
        }
        subtitle={!isDebugIdBundle && <VersionAndDetails>{bundleId}</VersionAndDetails>}
      />
      {isDebugIdBundle && debugIdBundlesArtifactsData && (
        <DetailsPanel>
          <DebugIdBundleDetails
            debugIdBundle={debugIdBundlesArtifactsData}
            projectId={project.id}
          />
        </DetailsPanel>
      )}
      <SearchBarWithMarginBottom
        placeholder={isDebugIdBundle ? t('Filter by Path or ID') : t('Filter by Path')}
        onSearch={handleSearch}
        query={query}
      />
      <StyledPanelTable
        hasTypeColumn={isDebugIdBundle}
        headers={[
          t('Artifact'),
          ...(isDebugIdBundle ? [<TypeColumn key="type">{t('Type')}</TypeColumn>] : []),
          <SizeColumn key="file-size">{t('File Size')}</SizeColumn>,
          '',
        ]}
        emptyMessage={
          query
            ? t('No artifacts match your search query.')
            : t('There are no artifacts in this upload.')
        }
        isEmpty={
          (isDebugIdBundle
            ? (debugIdBundlesArtifactsData?.files ?? [])
            : (artifactsData ?? [])
          ).length === 0
        }
        isLoading={isDebugIdBundle ? debugIdBundlesArtifactsLoading : artifactsLoading}
      >
        {isDebugIdBundle
          ? (debugIdBundlesArtifactsData?.files ?? []).map(data => {
              const downloadUrl = `${api.baseUrl}/projects/${organization.slug}/${
                project.slug
              }/artifact-bundles/${encodeURIComponent(bundleId)}/files/${
                data.id
              }/?download=1`;

              return (
                <ArtifactsTableRow
                  key={data.id}
                  size={data.fileSize}
                  name={data.filePath}
                  type={
                    debugIdBundleTypeLabels[data.fileType as DebugIdBundleArtifactType]
                  }
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
              }/releases/${encodeURIComponent(bundleId)}/files/${data.id}/?download=1`;

              return (
                <ArtifactsTableRow
                  key={data.id}
                  size={data.size}
                  name={data.name}
                  downloadUrl={downloadUrl}
                  orgSlug={organization.slug}
                  artifactColumnDetails={
                    <Flex align="center" marginTop="md" width="100%">
                      <TimeWrapper>
                        <IconClock size="sm" />
                        <TimeSince date={data.dateCreated} />
                      </TimeWrapper>
                      <Tooltip
                        title={data.dist ? undefined : t('No distribution set')}
                        skipWrapper
                      >
                        <StyledTag variant={data.dist ? 'info' : 'muted'}>
                          {data.dist ?? t('none')}
                        </StyledTag>
                      </Tooltip>
                    </Flex>
                  }
                />
              );
            })}
      </StyledPanelTable>
      <Pagination
        pageLinks={
          isDebugIdBundle
            ? (debugIdBundlesArtifactsHeaders?.('Link') ?? '')
            : (artifactsHeaders?.('Link') ?? '')
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
    css`
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

const TypeColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
`;

const SizeColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
`;

const TimeWrapper = styled('div')`
  display: grid;
  gap: ${space(0.5)};
  grid-template-columns: min-content 1fr;
  font-size: ${p => p.theme.fontSize.md};
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
`;

const StyledTag = styled(Tag)`
  margin-left: ${space(1)};
`;

const SubText = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const VersionAndDetails = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  word-break: break-word;
`;
