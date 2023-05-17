import {Fragment, useCallback, useEffect} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import Badge from 'sentry/components/badge';
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
import {IconArrow, IconDelete, IconWarning} from 'sentry/icons';
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

enum SourceMapsBundleType {
  Release,
  DebugId,
}

function SourceMapsTableRow({
  bundleType,
  onDelete,
  name,
  fileCount,
  link,
  date,
  idColumnDetails,
}: {
  bundleType: SourceMapsBundleType;
  date: string;
  fileCount: number;
  link: string;
  name: string;
  onDelete: (name: string) => void;
  idColumnDetails?: React.ReactNode;
}) {
  const isEmptyReleaseBundle =
    bundleType === SourceMapsBundleType.Release && fileCount === -1;

  return (
    <Fragment>
      <IDColumn>
        {isEmptyReleaseBundle ? name : <Link to={link}>{name}</Link>}
        {idColumnDetails}
      </IDColumn>
      <ArtifactsTotalColumn>
        {isEmptyReleaseBundle ? (
          <Tooltip title={t('No bundle connected to this release')}>
            <IconWrapper>
              <IconWarning color="warning" size="sm" />
            </IconWrapper>
          </Tooltip>
        ) : (
          <Count value={fileCount} />
        )}
      </ArtifactsTotalColumn>
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

  const sourceMapsUrl = normalizeUrl(
    `/settings/${organization.slug}/projects/${project.slug}/source-maps/`
  );

  const tabDebugIdBundlesActive = location.pathname === debugIdsUrl;

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
        query: {query, cursor, sortBy},
      },
    ],
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
        <ListLink to={debugIdsUrl} index isActive={() => tabDebugIdBundlesActive}>
          {t('Artifact Bundles')}
        </ListLink>
        <ListLink to={releaseBundlesUrl} isActive={() => !tabDebugIdBundlesActive}>
          {t('Release Bundles')}
          <Tooltip
            title={tct(
              'Release Bundles have been deprecated in favor of Artifact Bundles. Learn more about [link:Artifact Bundles].',
              {
                link: (
                  <ExternalLink
                    href="https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/artifact-bundles/"
                    onClick={event => {
                      event.stopPropagation();
                    }}
                  />
                ),
              }
            )}
            isHoverable
          >
            <Badge type="warning" text={t('Deprecated')} />
          </Tooltip>
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
          (tabDebugIdBundlesActive ? debugIdBundlesData ?? [] : archivesData ?? [])
            .length === 0
        }
        isLoading={tabDebugIdBundlesActive ? debugIdBundlesLoading : archivesLoading}
      >
        {tabDebugIdBundlesActive
          ? debugIdBundlesData?.map(data => (
              <SourceMapsTableRow
                key={data.bundleId}
                bundleType={SourceMapsBundleType.DebugId}
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
          : archivesData?.map(data => (
              <SourceMapsTableRow
                key={data.name}
                bundleType={SourceMapsBundleType.Release}
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
            ? debugIdBundlesHeaders?.('Link') ?? ''
            : archivesHeaders?.('Link') ?? ''
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

const IconWrapper = styled('div')`
  display: flex;
`;
