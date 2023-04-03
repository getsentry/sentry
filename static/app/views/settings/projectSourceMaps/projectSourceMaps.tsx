import {Fragment, useCallback} from 'react';
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
import {PanelTable} from 'sentry/components/panels';
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
import {DebugIdBundlesTags} from 'sentry/views/settings/projectSourceMaps/debugIdBundlesTags';

enum SORT_BY {
  ASC = 'date_added',
  DESC = '-date_added',
}

function SourceMapsTableRow({
  onDelete,
  name,
  fileCount,
  link,
  date,
  idColumnDetails,
}: {
  date: string;
  fileCount: number;
  link: string;
  name: string;
  onDelete: (name: string) => void;
  idColumnDetails?: React.ReactNode;
}) {
  return (
    <Fragment>
      <IDColumn>
        <Link to={link}>{name}</Link>
        {idColumnDetails}
      </IDColumn>
      <ArtifactsTotalColumn>
        <Count value={fileCount} />
      </ArtifactsTotalColumn>
      <Column>
        <DateTime date={date} timeZone />
      </Column>
      <ActionsColumn>
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

  // query params
  const query = decodeScalar(location.query.query);
  const sortBy = location.query.sort ?? SORT_BY.DESC;
  const cursor = location.query.cursor ?? '';

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

  const tabDebugIdBundlesActive = location.pathname === debugIdsUrl;

  const {
    data: archivesData,
    isLoading: archivesLoading,
    refetch: archivesRefetch,
  } = useApiQuery<[SourceMapsArchive[], any, any]>(
    [
      sourceMapsEndpoint,
      {
        query: {query, cursor, sortBy},
      },
    ],
    () => {
      return api.requestPromise(sourceMapsEndpoint, {
        query: {query, cursor, sortBy},
        includeAllArgs: true,
      });
    },
    {
      staleTime: 0,
      keepPreviousData: true,
      enabled: !tabDebugIdBundlesActive,
    }
  );

  const {
    data: debugIdBundlesData,
    isLoading: debugIdBundlesLoading,
    refetch: debugIdBundlesRefetch,
  } = useApiQuery<[DebugIdBundle[], any, any]>(
    [
      debugIdBundlesEndpoint,
      {
        query: {query, cursor, sortBy},
      },
    ],
    () => {
      return api.requestPromise(debugIdBundlesEndpoint, {
        query: {query, cursor, sortBy},
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

  const handleSortChange = useCallback(() => {
    router.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        sort: sortBy === SORT_BY.ASC ? SORT_BY.DESC : SORT_BY.ASC,
      },
    });
  }, [location, router, sortBy]);

  const handleDelete = useCallback(
    async (name: string) => {
      addLoadingMessage(t('Removing artifacts\u2026'));
      try {
        await api.requestPromise(
          tabDebugIdBundlesActive ? debugIdBundlesEndpoint : sourceMapsEndpoint,
          {
            method: 'DELETE',
            query: tabDebugIdBundlesActive ? {bundleId: name} : {name},
          }
        );
        tabDebugIdBundlesActive ? debugIdBundlesRefetch() : archivesRefetch();
        addSuccessMessage(t('Artifacts removed.'));
      } catch {
        addErrorMessage(t('Unable to remove artifacts. Please try again.'));
      }
    },
    [
      api,
      sourceMapsEndpoint,
      tabDebugIdBundlesActive,
      debugIdBundlesRefetch,
      archivesRefetch,
      debugIdBundlesEndpoint,
    ]
  );

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
        <ListLink to={releaseBundlesUrl} index isActive={() => !tabDebugIdBundlesActive}>
          {t('Release Bundles')}
        </ListLink>
        <ListLink to={debugIdsUrl} isActive={() => tabDebugIdBundlesActive}>
          {t('Artifact Bundles')}
        </ListLink>
      </NavTabs>
      <SearchBarWithMarginBottom
        placeholder={
          tabDebugIdBundlesActive ? t('Filter by Bundle ID') : t('Filter by Name')
        }
        onSearch={handleSearch}
        query={query}
      />
      <StyledPanelTable
        headers={[
          tabDebugIdBundlesActive ? t('Bundle ID') : t('Name'),
          <ArtifactsTotalColumn key="artifacts-total">
            {t('Artifacts')}
          </ArtifactsTotalColumn>,
          <DateUploadedColumn key="date-uploaded" onClick={handleSortChange}>
            {t('Date Uploaded')}
            <Tooltip
              containerDisplayMode="inline-flex"
              title={
                sortBy === SORT_BY.DESC
                  ? t('Switch to ascending order')
                  : t('Switch to descending order')
              }
            >
              <IconArrow
                direction={sortBy === SORT_BY.DESC ? 'down' : 'up'}
                data-test-id="icon-arrow"
              />
            </Tooltip>
          </DateUploadedColumn>,
          '',
        ]}
        emptyMessage={
          query
            ? tct('No [tabName] match your search query.', {
                tabName: tabDebugIdBundlesActive
                  ? t('debug ID bundles')
                  : t('release bundles'),
              })
            : tct('No [tabName] found for this project.', {
                tabName: tabDebugIdBundlesActive
                  ? t('debug ID bundles')
                  : t('release bundles'),
              })
        }
        isEmpty={
          (tabDebugIdBundlesActive
            ? debugIdBundlesData?.[0] ?? []
            : archivesData?.[0] ?? []
          ).length === 0
        }
        isLoading={tabDebugIdBundlesActive ? debugIdBundlesLoading : archivesLoading}
      >
        {tabDebugIdBundlesActive
          ? debugIdBundlesData?.[0].map(data => (
              <SourceMapsTableRow
                key={data.bundleId}
                date={data.date}
                fileCount={data.fileCount}
                name={data.bundleId}
                onDelete={handleDelete}
                link={`/settings/${organization.slug}/projects/${
                  project.slug
                }/source-maps/artifact-bundles/${encodeURIComponent(data.bundleId)}`}
                idColumnDetails={
                  <DebugIdBundlesTags dist={data.dist} release={data.release} />
                }
              />
            ))
          : archivesData?.[0].map(data => (
              <SourceMapsTableRow
                key={data.name}
                date={data.date}
                fileCount={data.fileCount}
                name={data.name}
                onDelete={handleDelete}
                link={`/settings/${organization.slug}/projects/${
                  project.slug
                }/source-maps/release-bundles/${encodeURIComponent(data.name)}`}
              />
            ))}
      </StyledPanelTable>
      <Pagination
        pageLinks={
          tabDebugIdBundlesActive
            ? debugIdBundlesData?.[2]?.getResponseHeader('Link') ?? ''
            : archivesData?.[2]?.getResponseHeader('Link') ?? ''
        }
      />
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)`
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
