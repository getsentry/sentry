import {Fragment, useCallback, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import Confirm from 'sentry/components/confirm';
import {Button, type ButtonProps} from 'sentry/components/core/button';
import {CodeBlock} from 'sentry/components/core/code';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import EmptyMessage from 'sentry/components/emptyMessage';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {
  getSourceMapsDocLinks,
  projectPlatformToDocsMap,
} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import SearchBar from 'sentry/components/searchBar';
import {IconDelete, IconUpload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {KeyValueListData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Release, SourceMapsArchive} from 'sentry/types/release';
import type {DebugIdBundle, DebugIdBundleAssociation} from 'sentry/types/sourceMaps';
import {defined} from 'sentry/utils';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {AssociatedReleases} from 'sentry/views/settings/projectSourceMaps/associatedReleases';
import {useDeleteDebugIdBundle} from 'sentry/views/settings/projectSourceMaps/useDeleteDebugIdBundle';

type Props = {
  project: Project;
};

type SourceMapUpload = {
  associations: DebugIdBundleAssociation[];
  date: string;
  dateModified: string;
  fileCount: number;
  id: string; // bundleId or release name
  type: 'debugId' | 'release';
};

function mergeReleaseAndDebugIdBundles(
  releases: SourceMapsArchive[] | undefined,
  debugIdBundles: DebugIdBundle[] | undefined
): SourceMapUpload[] {
  const debugIdUploads: SourceMapUpload[] = (debugIdBundles ?? []).map(debugIdBundle => ({
    ...debugIdBundle,
    id: debugIdBundle.bundleId,
    type: 'debugId',
  }));

  const nonEmptyReleases = (releases ?? []).filter(release => release.fileCount > 0);
  const releaseUploads: SourceMapUpload[] = nonEmptyReleases.map(release => ({
    associations: [{dist: null, release: release.name}],
    date: release.date,
    dateModified: release.date,
    fileCount: release.fileCount,
    type: 'release',
    id: release.name,
  }));

  return [...debugIdUploads, ...releaseUploads] as SourceMapUpload[];
}

interface UseSourceMapUploadsProps {
  cursor: string | undefined;
  organization: Organization;
  project: Project;
  query: string | undefined;
}

function useSourceMapUploads({
  organization,
  project,
  query,
  cursor,
}: UseSourceMapUploadsProps) {
  const {
    data: archivesData,
    getResponseHeader: archivesHeaders,
    isPending: archivesLoading,
    refetch: archivesRefetch,
  } = useApiQuery<SourceMapsArchive[]>(
    [
      `/projects/${organization.slug}/${project.slug}/files/source-maps/`,
      {
        query: {query, cursor, sortBy: '-date_added'},
      },
    ],
    {
      staleTime: 0,
      placeholderData: keepPreviousData,
    }
  );

  const {
    data: debugIdBundlesData,
    getResponseHeader: debugIdBundlesHeaders,
    isPending: debugIdBundlesLoading,
    refetch: debugIdBundlesRefetch,
  } = useApiQuery<DebugIdBundle[]>(
    [
      `/projects/${organization.slug}/${project.slug}/files/artifact-bundles/`,
      {
        query: {query, cursor, sortBy: '-date_added'},
      },
    ],
    {
      staleTime: 0,
      placeholderData: keepPreviousData,
    }
  );

  const mergedData = mergeReleaseAndDebugIdBundles(archivesData, debugIdBundlesData);
  const releaseVersions = mergedData.flatMap(data =>
    data.associations.map(association => `"${association.release}"`)
  );

  const {data: releasesData, isPending: releasesLoading} = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          project: [project.id],
          query: `release:[${releaseVersions.join(',')}]`,
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: false,
      enabled: !debugIdBundlesLoading && !archivesLoading,
    }
  );

  const existingReleaseNames = new Set((releasesData ?? []).map(r => r.version));

  return {
    data: releasesLoading
      ? mergedData
      : mergedData.map(data => ({
          ...data,
          associations: data.associations.map(association => ({
            ...association,
            exists: existingReleaseNames.has(association.release),
          })),
        })),
    headers: (header: string) => {
      return debugIdBundlesHeaders?.(header) ?? archivesHeaders?.(header);
    },
    isPending: archivesLoading || debugIdBundlesLoading,
    refetch: () => {
      archivesRefetch();
      debugIdBundlesRefetch();
    },
  };
}

export function SourceMapsList({project}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const query = decodeScalar(location.query.query);
  const cursor = decodeScalar(location.query.cursor);

  const {
    data: sourceMapUploads,
    headers,
    isPending,
    refetch,
  } = useSourceMapUploads({
    organization,
    project,
    query,
    cursor,
  });

  const {mutate: deleteSourceMaps} = useDeleteDebugIdBundle({
    onSuccess: () => refetch(),
  });

  const handleSearch = useCallback(
    (newQuery: string) => {
      navigate({
        ...location,
        query: {...location.query, cursor: undefined, query: newQuery},
      });
    },
    [navigate, location]
  );

  const platformByProject = defined(project.platform)
    ? projectPlatformToDocsMap[project.platform]
    : undefined;
  const platform = platformByProject ?? project.platform ?? 'javascript';
  const sourceMapsLinks = getSourceMapsDocLinks(platform);

  return (
    <Fragment>
      <SettingsPageHeader title={t('Source Map Uploads')} />
      <TextBlock>
        {tct(
          `These source map archives help Sentry identify where to look when code is minified. By providing this information, you can get better context for your stack traces when debugging. To learn more about source maps, [link: read the docs].`,
          {
            link: <ExternalLink href={sourceMapsLinks.sourcemaps} />,
          }
        )}
      </TextBlock>
      <SearchBarWithMarginBottom
        placeholder={t('Filter by Debug ID or Upload ID')}
        onSearch={handleSearch}
        query={query}
      />
      <SourceMapUploadsList
        project={project}
        sourceMapUploads={sourceMapUploads}
        isLoading={isPending}
        query={query}
        onClearSearch={() => handleSearch('')}
        onDelete={id => {
          deleteSourceMaps({bundleId: id, projectSlug: project.slug});
        }}
        docsLink={sourceMapsLinks.sourcemaps}
        pageLinks={headers?.('Link') ?? ''}
      />
    </Fragment>
  );
}

function ReactNativeCallOut() {
  const [selectedTab, setSelectedTab] = useState('expo');

  return (
    <div
      css={css`
        text-align: left;
        display: grid;
        gap: ${space(1)};
      `}
    >
      <div>
        {tct(
          'For React Native projects, ensure you [strong:run the app in release mode] and execute the scripts below to upload source maps for both iOS and Android:',
          {strong: <strong />}
        )}
      </div>
      <CodeBlock
        dark
        language="bash"
        tabs={[
          {label: 'Expo', value: 'expo'},
          {label: 'React Native', value: 'react-native'},
        ]}
        selectedTab={selectedTab}
        onTabClick={value => setSelectedTab(value)}
      >
        {selectedTab === 'expo'
          ? '# First run this to create a build and upload source maps\n./gradlew assembleRelease\n# Then run this to test your build locally\nnpx expo run:android --variant release\n\n# iOS version (pending confirmation)\nnpx expo run:ios --configuration Release'
          : 'npx react-native run-android --mode release\nnpx react-native run-ios --mode Release'}
      </CodeBlock>
    </div>
  );
}

interface SourceMapsEmptyStateProps {
  docsLink: string;
  onClearSearch: () => void;
  project: Project;
  query?: string;
}

function SourceMapsEmptyState({
  query,
  onClearSearch,
  project,
  docsLink,
}: SourceMapsEmptyStateProps) {
  return (
    <Panel dashedBorder>
      <EmptyMessage
        title={
          query
            ? t('No source maps uploads matching your search')
            : t('No source maps uploaded')
        }
        action={project.platform === 'react-native' ? <ReactNativeCallOut /> : undefined}
      >
        {query
          ? tct(
              'Try to modify or [clear:clear] your search to see all source maps uploads.',
              {
                clear: (
                  <Button
                    priority="link"
                    aria-label={t('Clear Search')}
                    onClick={onClearSearch}
                  />
                ),
              }
            )
          : tct(
              'Source maps allow Sentry to map your production code to your source code. See our [docs:docs] to learn more about configuring your application to upload source maps to Sentry.',
              {
                docs: <ExternalLink href={docsLink} />,
              }
            )}
      </EmptyMessage>
    </Panel>
  );
}

interface SourceMapUploadsListProps {
  docsLink: string;
  isLoading: boolean;
  onClearSearch: () => void;
  onDelete: (id: string) => void;
  project: Project;
  pageLinks?: string;
  query?: string;
  sourceMapUploads?: SourceMapUpload[];
}

function SourceMapUploadsList({
  onClearSearch,
  isLoading,
  sourceMapUploads,
  onDelete,
  project,
  query,
  docsLink,
  pageLinks,
}: SourceMapUploadsListProps) {
  const organization = useOrganization();

  const sourceMapUploadDetailLink = useCallback(
    (sourceMapUpload: SourceMapUpload) => {
      return `/settings/${organization.slug}/projects/${project.slug}/source-maps/${encodeURIComponent(sourceMapUpload.id)}/`;
    },
    [organization, project]
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!sourceMapUploads || sourceMapUploads.length === 0) {
    return (
      <SourceMapsEmptyState
        project={project}
        query={query}
        onClearSearch={onClearSearch}
        docsLink={docsLink}
      />
    );
  }

  return (
    <Fragment>
      <List>
        {sourceMapUploads.map(sourceMapUpload => (
          <Item key={sourceMapUpload.id}>
            <ItemHeader>
              <ItemTitle to={sourceMapUploadDetailLink(sourceMapUpload)}>
                <IconUpload />
                {tct('[date] ([fileCount] files)', {
                  date: <DateTime year date={sourceMapUpload.date} />,
                  fileCount: sourceMapUpload.fileCount,
                })}
              </ItemTitle>
              <SourceMapUploadDeleteButton
                onDelete={
                  sourceMapUpload.type === 'debugId'
                    ? () => onDelete(sourceMapUpload.id)
                    : undefined
                }
              />
            </ItemHeader>
            <ItemContent>
              <SourceMapUploadDetails
                sourceMapUpload={sourceMapUpload}
                projectId={project.id}
              />
            </ItemContent>
          </Item>
        ))}
      </List>
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

function SourceMapUploadDetails({
  sourceMapUpload,
  projectId,
}: {
  projectId: string;
  sourceMapUpload: SourceMapUpload;
}) {
  const [showAll, setShowAll] = useState(false);
  const detailsData = useMemo<KeyValueListData>(() => {
    const rows = sourceMapUpload.associations;

    const visibleAssociations = showAll ? rows : rows.slice(0, 3);
    return [
      {
        key: 'id',
        subject: t('Upload ID'),
        value: sourceMapUpload.id,
      },
      {
        key: 'releases',
        subject: t('Found in Releases'),
        actionButton: rows.length > 3 && (
          <Button size="xs" onClick={() => setShowAll(value => !value)}>
            {showAll ? t('Show Less') : t('Show All')}
          </Button>
        ),
        value: (
          <AssociatedReleases associations={visibleAssociations} projectId={projectId} />
        ),
      },
    ];
  }, [sourceMapUpload, showAll, projectId]);

  return <StyledKeyValueList data={detailsData} shouldSort={false} />;
}

interface SourceMapUploadDeleteButtonProps {
  onDelete?: () => void;
  size?: ButtonProps['size'];
}

function SourceMapUploadDeleteButton({onDelete}: SourceMapUploadDeleteButtonProps) {
  const tooltipTitle = useCallback((hasAccess: boolean, canDelete: boolean) => {
    if (hasAccess) {
      if (canDelete) {
        return t('Delete Source Maps');
      }
      return t('Source maps cannot be deleted.');
    }
    return t('You do not have permission to delete Source Maps.');
  }, []);

  return (
    <Access access={['project:releases']}>
      {({hasAccess}) => (
        <Tooltip
          disabled={hasAccess && !!onDelete}
          title={tooltipTitle(hasAccess, !!onDelete)}
        >
          <Confirm
            onConfirm={onDelete}
            message={t('Are you sure you want to delete Source Maps?')}
            disabled={!hasAccess || !onDelete}
          >
            <Button icon={<IconDelete size="xs" />} size="xs" disabled={!hasAccess}>
              {t('Delete Source Maps')}
            </Button>
          </Confirm>
        </Tooltip>
      )}
    </Access>
  );
}

const StyledKeyValueList = styled(KeyValueList)`
  && {
    margin-bottom: 0;
  }
`;

const List = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(2)};
`;

const Item = styled(Panel)`
  margin: 0;
`;

const ItemHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSize.md};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  line-height: 1;
  padding: ${space(1)} ${space(2)};
`;

const ItemTitle = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const ItemContent = styled('div')`
  padding: ${space(1)} ${space(2)};
`;

const SearchBarWithMarginBottom = styled(SearchBar)`
  margin-bottom: ${space(3)};
`;
