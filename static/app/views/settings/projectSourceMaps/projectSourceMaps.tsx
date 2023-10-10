import {Fragment, useCallback, useEffect, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import Count from 'sentry/components/count';
import DateTime from 'sentry/components/dateTime';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import Pagination from 'sentry/components/pagination';
import PanelTable from 'sentry/components/panels/panelTable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import SearchBar from 'sentry/components/searchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DebugIdBundle, Project, SourceMapsArchive} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {DebugIdBundleList} from 'sentry/views/settings/projectSourceMaps/debugIdBundleList';
import {useDeleteDebugIdBundle} from 'sentry/views/settings/projectSourceMaps/useDeleteDebugIdBundle';

enum SortBy {
  ASC_ADDED = 'date_added',
  DESC_ADDED = '-date_added',
  ASC_MODIFIED = 'date_modified',
  DESC_MODIFIED = '-date_modified',
}

enum SourceMapsBundleType {
  RELEASE,
  DEBUG_ID,
}

function SourceMapsTableRow({
  bundleType,
  onDelete,
  name,
  fileCount,
  link,
  dateModified,
  date,
  idColumnDetails,
}: {
  bundleType: SourceMapsBundleType;
  date: string;
  fileCount: number;
  link: string;
  name: string;
  onDelete: (name: string) => void;
  dateModified?: string;
  idColumnDetails?: React.ReactNode;
}) {
  const isEmptyReleaseBundle =
    bundleType === SourceMapsBundleType.RELEASE && fileCount === -1;
  const showDateModified =
    bundleType === SourceMapsBundleType.DEBUG_ID && dateModified !== undefined;

  return (
    <Fragment>
      <IDColumn>
        {isEmptyReleaseBundle ? name : <Link to={link}>{name}</Link>}
        {idColumnDetails}
      </IDColumn>
      <ArtifactsTotalColumn>
        {isEmptyReleaseBundle ? (
          <NoArtifactsUploadedWrapper>
            <QuestionTooltip
              size="xs"
              position="top"
              title={t('A Release was created, but no artifacts were uploaded')}
            />
            {'0'}
          </NoArtifactsUploadedWrapper>
        ) : (
          <Count value={fileCount} />
        )}
      </ArtifactsTotalColumn>
      {showDateModified && (
        <Column>
          <DateTime date={dateModified} timeZone />
        </Column>
      )}
      <Column>
        {isEmptyReleaseBundle ? t('(no value)') : <DateTime date={date} timeZone />}
      </Column>
      <ActionsColumn>
        {isEmptyReleaseBundle ? (
          <Button
            size="sm"
            icon={<IconDelete size="sm" />}
            title={t('No bundle to delete')}
            aria-label={t('No bundle to delete')}
            disabled
          />
        ) : (
          <Access access={['project:releases']}>
            {({hasAccess}) => (
              <Tooltip
                disabled={hasAccess}
                title={t('You do not have permission to delete artifacts.')}
              >
                <Confirm
                  onConfirm={() => onDelete(name)}
                  message={t(
                    'Are you sure you want to remove all artifacts in this archive?'
                  )}
                  disabled={!hasAccess}
                >
                  <Button
                    size="sm"
                    icon={<IconDelete size="sm" />}
                    title={t('Remove All Artifacts')}
                    aria-label={t('Remove All Artifacts')}
                    disabled={!hasAccess}
                  />
                </Confirm>
              </Tooltip>
            )}
          </Access>
        )}
      </ActionsColumn>
    </Fragment>
  );
}

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  project: Project;
};

export function ProjectSourceMaps({location, router, project}: Props) {
  const api = useApi();
  const organization = useOrganization();

  // endpoints
  const sourceMapsEndpoint = `/projects/${organization.slug}/${project.slug}/files/source-maps/`;
  const debugIdBundlesEndpoint = `/projects/${organization.slug}/${project.slug}/files/artifact-bundles/`;

  // tab urls
  const releaseBundlesUrl = normalizeUrl(
    `/settings/${organization.slug}/projects/${project.slug}/source-maps/release-bundles/`
  );
  const debugIdsUrl = normalizeUrl(
    `/settings/${organization.slug}/projects/${project.slug}/source-maps/artifact-bundles/`
  );

  const sourceMapsUrl = normalizeUrl(
    `/settings/${organization.slug}/projects/${project.slug}/source-maps/`
  );

  const tabDebugIdBundlesActive = location.pathname === debugIdsUrl;

  // query params
  const query = decodeScalar(location.query.query);

  const [sortBy, setSortBy] = useState(
    location.query.sort ?? tabDebugIdBundlesActive
      ? SortBy.DESC_MODIFIED
      : SortBy.DESC_ADDED
  );
  // The default sorting order changes based on the tab.
  const cursor = location.query.cursor ?? '';

  useEffect(() => {
    if (location.pathname === sourceMapsUrl) {
      router.replace(debugIdsUrl);
    }
  }, [location.pathname, sourceMapsUrl, debugIdsUrl, router]);

  const {
    data: archivesData,
    getResponseHeader: archivesHeaders,
    isLoading: archivesLoading,
    refetch: archivesRefetch,
  } = useApiQuery<SourceMapsArchive[]>(
    [
      sourceMapsEndpoint,
      {
        query: {query, cursor, sortBy},
      },
    ],
    {
      staleTime: 0,
      keepPreviousData: true,
      enabled: !tabDebugIdBundlesActive,
    }
  );

  const {
    data: debugIdBundlesData,
    getResponseHeader: debugIdBundlesHeaders,
    isLoading: debugIdBundlesLoading,
    refetch: debugIdBundlesRefetch,
  } = useApiQuery<DebugIdBundle[]>(
    [
      debugIdBundlesEndpoint,
      {
        query: {query, cursor, sortBy: SortBy.DESC_MODIFIED},
      },
    ],
    {
      staleTime: 0,
      keepPreviousData: true,
      enabled: tabDebugIdBundlesActive,
    }
  );

  const {mutate: deleteDebugIdBundle} = useDeleteDebugIdBundle({
    onSuccess: () => debugIdBundlesRefetch(),
  });

  const handleSearch = useCallback(
    (newQuery: string) => {
      router.push({
        ...location,
        query: {...location.query, cursor: undefined, query: newQuery},
      });
    },
    [router, location]
  );

  const handleSortChangeForModified = useCallback(() => {
    const newSortBy =
      sortBy !== SortBy.DESC_MODIFIED ? SortBy.DESC_MODIFIED : SortBy.ASC_MODIFIED;
    setSortBy(newSortBy);
    router.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        sort: newSortBy,
      },
    });
  }, [location, router, sortBy]);

  const handleSortChangeForAdded = useCallback(() => {
    const newSortBy = sortBy !== SortBy.DESC_ADDED ? SortBy.DESC_ADDED : SortBy.ASC_ADDED;
    setSortBy(newSortBy);
    router.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        sort: newSortBy,
      },
    });
  }, [location, router, sortBy]);

  const handleDeleteReleaseArtifacts = useCallback(
    async (name: string) => {
      addLoadingMessage(t('Removing artifacts\u2026'));
      try {
        await api.requestPromise(sourceMapsEndpoint, {
          method: 'DELETE',
          query: {name},
        });
        archivesRefetch();
        addSuccessMessage(t('Artifacts removed.'));
      } catch {
        addErrorMessage(t('Unable to remove artifacts. Please try again.'));
      }
    },
    [api, sourceMapsEndpoint, archivesRefetch]
  );

  const currentBundleType = tabDebugIdBundlesActive
    ? SourceMapsBundleType.DEBUG_ID
    : SourceMapsBundleType.RELEASE;
  const tableHeaders = [
    {
      component: tabDebugIdBundlesActive ? t('Bundle ID') : t('Name'),
      enabledFor: [SourceMapsBundleType.RELEASE, SourceMapsBundleType.DEBUG_ID],
    },
    {
      component: (
        <ArtifactsTotalColumn key="artifacts-total">
          {t('Artifacts')}
        </ArtifactsTotalColumn>
      ),
      enabledFor: [SourceMapsBundleType.RELEASE, SourceMapsBundleType.DEBUG_ID],
    },
    {
      component: (
        <DateUploadedColumn
          key="date-modified"
          data-test-id="date-modified-header"
          onClick={handleSortChangeForModified}
        >
          {t('Date Modified')}
          {(sortBy === SortBy.ASC_MODIFIED || sortBy === SortBy.DESC_MODIFIED) && (
            <Tooltip
              containerDisplayMode="inline-flex"
              title={
                sortBy === SortBy.DESC_MODIFIED
                  ? t('Switch to ascending order')
                  : t('Switch to descending order')
              }
            >
              <IconArrow
                direction={sortBy === SortBy.DESC_MODIFIED ? 'down' : 'up'}
                data-test-id="icon-arrow-modified"
              />
            </Tooltip>
          )}
        </DateUploadedColumn>
      ),
      enabledFor: [SourceMapsBundleType.DEBUG_ID],
    },
    {
      component: (
        <DateUploadedColumn
          key="date-uploaded"
          data-test-id="date-uploaded-header"
          onClick={handleSortChangeForAdded}
        >
          {t('Date Uploaded')}
          {(sortBy === SortBy.ASC_ADDED || sortBy === SortBy.DESC_ADDED) && (
            <Tooltip
              containerDisplayMode="inline-flex"
              title={
                sortBy === SortBy.DESC_ADDED
                  ? t('Switch to ascending order')
                  : t('Switch to descending order')
              }
            >
              <IconArrow
                direction={sortBy === SortBy.DESC_ADDED ? 'down' : 'up'}
                data-test-id="icon-arrow"
              />
            </Tooltip>
          )}
        </DateUploadedColumn>
      ),
      enabledFor: [SourceMapsBundleType.RELEASE, SourceMapsBundleType.DEBUG_ID],
    },
    {
      component: '',
      enabledFor: [SourceMapsBundleType.RELEASE, SourceMapsBundleType.DEBUG_ID],
    },
  ];

  const Table =
    currentBundleType === SourceMapsBundleType.DEBUG_ID
      ? ArtifactBundlesPanelTable
      : ReleaseBundlesPanelTable;

  return (
    <Fragment>
      <SettingsPageHeader title={t('Source Maps')} />
      <TextBlock>
        {tct(
          `These source map archives help Sentry identify where to look when Javascript is minified. By providing this information, you can get better context for your stack traces when debugging. To learn more about source maps, [link: read the docs].`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/" />
            ),
          }
        )}
      </TextBlock>
      <NavTabs underlined>
        <ListLink
          to={{
            pathname: debugIdsUrl,
            query: location.query,
          }}
          index
          isActive={() => tabDebugIdBundlesActive}
        >
          {t('Artifact Bundles')}
        </ListLink>
        <ListLink
          to={{
            pathname: releaseBundlesUrl,
            query: location.query,
          }}
          isActive={() => !tabDebugIdBundlesActive}
        >
          {t('Release Bundles')}
        </ListLink>
      </NavTabs>
      <SearchBarWithMarginBottom
        placeholder={
          tabDebugIdBundlesActive
            ? t('Filter by Bundle ID, Debug ID or Release')
            : t('Filter by Name')
        }
        onSearch={handleSearch}
        query={query}
      />
      {tabDebugIdBundlesActive ? (
        <DebugIdBundleList
          isLoading={debugIdBundlesLoading}
          debugIdBundles={debugIdBundlesData}
          project={project}
          onDelete={bundleId =>
            deleteDebugIdBundle({bundleId, projectSlug: project.slug})
          }
          emptyMessage={
            query
              ? t('No artifact bundles match your search query.')
              : t('No artifact bundles found for this project.')
          }
        />
      ) : (
        <Table
          headers={tableHeaders
            .filter(header => header.enabledFor.includes(currentBundleType))
            .map(header => header.component)}
          emptyMessage={
            query
              ? t('No release bundles match your search query.')
              : t('No release bundles found for this project.')
          }
          isEmpty={(archivesData ?? []).length === 0}
          isLoading={archivesLoading}
        >
          {archivesData?.map(data => (
            <SourceMapsTableRow
              key={data.name}
              bundleType={SourceMapsBundleType.RELEASE}
              date={data.date}
              fileCount={data.fileCount}
              name={data.name}
              onDelete={handleDeleteReleaseArtifacts}
              link={`/settings/${organization.slug}/projects/${
                project.slug
              }/source-maps/release-bundles/${encodeURIComponent(data.name)}`}
            />
          ))}
        </Table>
      )}
      <Pagination
        pageLinks={
          tabDebugIdBundlesActive
            ? debugIdBundlesHeaders?.('Link') ?? ''
            : archivesHeaders?.('Link') ?? ''
        }
      />
    </Fragment>
  );
}

const ReleaseBundlesPanelTable = styled(PanelTable)`
  grid-template-columns:
    minmax(120px, 1fr) minmax(120px, max-content) minmax(242px, max-content)
    minmax(74px, max-content);
  > * {
    :nth-child(-n + 4) {
      :nth-child(4n-1) {
        cursor: pointer;
      }
    }
  }
`;

const ArtifactBundlesPanelTable = styled(PanelTable)`
  grid-template-columns:
    minmax(120px, 1fr) minmax(120px, max-content) minmax(242px, max-content) minmax(
      242px,
      max-content
    )
    minmax(74px, max-content);
  > * {
    :nth-child(-n + 5) {
      :nth-child(5n-1) {
        cursor: pointer;
      }
    }
  }
`;

const ArtifactsTotalColumn = styled('div')`
  text-align: right;
  justify-content: flex-end;
  align-items: center;
  display: flex;
`;

const DateUploadedColumn = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const Column = styled('div')`
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const IDColumn = styled(Column)`
  line-height: 140%;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: ${space(0.5)};
  word-break: break-word;
`;

const ActionsColumn = styled(Column)`
  justify-content: flex-end;
`;

const SearchBarWithMarginBottom = styled(SearchBar)`
  margin-bottom: ${space(3)};
`;

const NoArtifactsUploadedWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
