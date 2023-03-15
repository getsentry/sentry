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
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {IconArrow, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import recreateRoute from 'sentry/utils/recreateRoute';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

enum SORT_BY {
  ASC = 'date_added',
  DESC = '-date_added',
}

type Props = RouteComponentProps<{}, {}> & {
  project: Project;
};

export function ProjectSourceMaps({routes, params, location, router, project}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const baseUrl = recreateRoute('', {routes, params, stepBack: -1});
  const tabDebugIdBundlesActive = location.pathname.endsWith('debug-id-bundles/');
  const query = decodeScalar(location.query.query);
  const sortBy = location.query.sort ?? SORT_BY.DESC;
  const cursor = location.query.cursor ?? '';
  const sourceMapsEndpoint = `/projects/${organization.slug}/${project.slug}/files/source-maps/`;
  const debugIdBundlesEndpoint = `/projects/${organization.slug}/${project.slug}/files/artifact-bundles/`;

  const {
    data: archivesData,
    isLoading: archivesLoading,
    refetch: archivesRefetch,
  } = useQuery(
    [
      sourceMapsEndpoint,
      {
        query: {query, cursor, orderby: sortBy},
      },
    ],
    () => {
      return api.requestPromise(sourceMapsEndpoint, {
        query: {query, cursor, orderby: sortBy},
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
  } = useQuery(
    [
      debugIdBundlesEndpoint,
      {
        query: {query, cursor, orderby: sortBy},
      },
    ],
    () => {
      return api.requestPromise(debugIdBundlesEndpoint, {
        query: {query, cursor, orderby: sortBy},
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
    : archivesData?.[0] ?? [];
  const pageLinks = tabDebugIdBundlesActive
    ? debugIdBundlesData?.[2]?.getResponseHeader('Link') ?? ''
    : archivesData?.[2]?.getResponseHeader('Link') ?? '';
  const loading = tabDebugIdBundlesActive ? debugIdBundlesLoading : archivesLoading;
  const refetch = tabDebugIdBundlesActive ? debugIdBundlesRefetch : archivesRefetch;

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
        await api.requestPromise(sourceMapsEndpoint, {
          method: 'DELETE',
          query: {name},
        });
        refetch();
        addSuccessMessage(t('Artifacts removed.'));
      } catch {
        addErrorMessage(t('Unable to remove artifacts. Please try again.'));
      }
    },
    [api, sourceMapsEndpoint, refetch]
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
        <ListLink to={baseUrl} index isActive={() => !tabDebugIdBundlesActive}>
          {t('Release Bundles')}
        </ListLink>
        <ListLink
          to={`${baseUrl}debug-id-bundles/`}
          index
          isActive={() => tabDebugIdBundlesActive}
        >
          {t('Debug ID Bundles')}
        </ListLink>
      </NavTabs>
      <SearchBarWithMarginBottom
        placeholder={t('Search')}
        onSearch={handleSearch}
        query={query}
      />
      <StyledPanelTable
        headers={[
          t('Bundle'),
          <ArtifactsColumn key="artifacts">{t('Artifacts')}</ArtifactsColumn>,
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
              <IconArrow direction={sortBy === SORT_BY.DESC ? 'down' : 'up'} />
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
        isEmpty={data.length === 0}
        isLoading={loading}
      >
        {data.map(({name, date, fileCount}) => {
          return (
            <Fragment key={name}>
              <Column>
                <TextOverflow>
                  <Link
                    to={`/settings/${organization.slug}/projects/${
                      project.slug
                    }/source-maps/${encodeURIComponent(name)}`}
                  >
                    <Version version={name} anchor={false} tooltipRawVersion truncate />
                  </Link>
                </TextOverflow>
              </Column>
              <ArtifactsColumn>
                <Count value={fileCount} />
              </ArtifactsColumn>
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
                        onConfirm={() => handleDelete(name)}
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
        })}
      </StyledPanelTable>
      <Pagination pageLinks={pageLinks} />
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

const SearchBarWithMarginBottom = styled(SearchBar)`
  margin-bottom: ${space(3)};
`;

const ArtifactsColumn = styled('div')`
  text-align: right;
  justify-content: flex-end;
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

const ActionsColumn = styled(Column)`
  justify-content: flex-end;
`;
