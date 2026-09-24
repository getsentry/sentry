import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Container} from '@sentry/scraps/layout';
import {Pagination, type CursorHandler} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useDeleteQuery} from 'sentry/views/explore/hooks/useDeleteQuery';
import {
  getSavedQueryDatasetLabel,
  getSavedQueryKey,
  getSavedQueryTraceItemDataset,
  isExploreSavedQuery,
  useGetSavedQueries,
  type CombinedSavedQuery,
  type SortOption,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useFromSavedQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {useStarQuery} from 'sentry/views/explore/hooks/useStarQuery';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {ExploreParams} from 'sentry/views/explore/savedQueries/exploreParams';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  confirmDeleteSavedQuery,
  getSavedQueryTraceItemUrl,
  getYAxisDiscoverSavedQuery,
} from 'sentry/views/explore/utils';

type Props = {
  title: string;
  cursorKey?: string;
  hideIfEmpty?: boolean;
  mode?: 'owned' | 'shared' | 'all';
  perPage?: number;
  searchQuery?: string;
  sort?: SortOption;
};

export function SavedQueriesTable({
  mode = 'all',
  perPage,
  cursorKey = 'cursor',
  searchQuery,
  sort = 'recentlyViewed',
  title,
  hideIfEmpty = false,
}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const showDatasetColumn =
    isLogsEnabled(organization) ||
    organization.features.includes('discover-queries-in-all-queries');
  const cursor = decodeScalar(location.query[cursorKey]);
  const {data, isLoading, pageLinks, isFetched, isError} = useGetSavedQueries({
    sortBy: ['starred', sort],
    exclude: mode === 'owned' ? 'shared' : mode === 'shared' ? 'owned' : undefined, // Inverse because this is an exclusion
    perPage,
    cursor,
    query: searchQuery,
  });

  const filteredData = data ?? [];
  const {deleteQuery} = useDeleteQuery();
  const {starQuery} = useStarQuery();
  const {saveQueryFromSavedQuery, updateQueryFromSavedQuery} = useFromSavedQuery();

  const [starredKeys, setStarredKeys] = useState<string[]>([]);

  useEffect(() => {
    if (isFetched) {
      // oxlint-disable-next-line react/set-state-in-effect
      setStarredKeys(data?.filter(row => row.starred).map(getSavedQueryKey) ?? []);
    }
  }, [isFetched, data]);

  const starQueryHandler = useCallback(
    (query: CombinedSavedQuery, starred: boolean) => {
      const key = getSavedQueryKey(query);
      if (starred) {
        setStarredKeys(prev => [...prev, key]);
      } else {
        setStarredKeys(prev => prev.filter(starredKey => starredKey !== key));
      }

      // Discover has no equivalent star analytics event, so only Explore rows report.
      if (isExploreSavedQuery(query)) {
        const dataset = getSavedQueryTraceItemDataset(query.dataset);
        if (dataset === TraceItemDataset.SPANS) {
          trackAnalytics('trace_explorer.star_query', {
            save_type: starred ? 'star_query' : 'unstar_query',
            ui_source: 'table',
            organization,
          });
        } else if (dataset === TraceItemDataset.LOGS) {
          trackAnalytics('logs.star_query', {
            save_type: starred ? 'star_query' : 'unstar_query',
            ui_source: 'table',
            organization,
          });
        }
      }

      starQuery({queryId: Number(query.id), queryType: query.queryType}, starred).catch(
        () => {
          // If the starQuery call fails, we need to revert the starredKeys state
          addErrorMessage(t('Unable to star query'));
          if (starred) {
            setStarredKeys(prev => prev.filter(starredKey => starredKey !== key));
          } else {
            setStarredKeys(prev => [...prev, key]);
          }
        }
      );
    },
    [starQuery, organization]
  );

  const getHandleUpdateFromSavedQuery = useCallback(
    (savedQuery: CombinedSavedQuery) => {
      return ({name}: {name: string}) => {
        return updateQueryFromSavedQuery({
          ...savedQuery,
          name,
        } as CombinedSavedQuery);
      };
    },
    [updateQueryFromSavedQuery]
  );

  const duplicateQuery = async (savedQuery: CombinedSavedQuery) => {
    await saveQueryFromSavedQuery({
      ...savedQuery,
      name: `${savedQuery.name} (Copy)`,
    } as CombinedSavedQuery);
  };

  const handleCursor: CursorHandler = (_cursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [cursorKey]: _cursor},
    });
  };

  const debouncedOnClick = useMemo(
    () =>
      debounce(
        (query: CombinedSavedQuery, starred: boolean) => {
          if (starred) {
            addLoadingMessage(t('Unstarring query...'));
            starQueryHandler(query, false);
            addSuccessMessage(t('Query unstarred'));
          } else {
            addLoadingMessage(t('Starring query...'));
            starQueryHandler(query, true);
            addSuccessMessage(t('Query starred'));
          }
        },
        1000,
        {leading: true}
      ),
    [starQueryHandler]
  );

  if (hideIfEmpty && filteredData.length === 0) {
    return null;
  }

  return (
    <Container containerType="inline-size">
      <TableHeading>{title}</TableHeading>
      <SavedEntityTable
        columns={savedQueryColumns(showDatasetColumn)}
        pageSize={perPage}
        isLoading={isLoading}
        header={
          <SavedEntityTable.Header>
            <SavedEntityTable.HeaderCell />
            <SavedEntityTable.HeaderCell divider={false}>
              {t('Name')}
            </SavedEntityTable.HeaderCell>
            {showDatasetColumn && (
              <SavedEntityTable.HeaderCell>{t('Type')}</SavedEntityTable.HeaderCell>
            )}
            <SavedEntityTable.HeaderCell>{t('Project')}</SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell>{t('Envs')}</SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell>{t('Query')}</SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell>{t('Creator')}</SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell>{t('Last Viewed')}</SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell />
          </SavedEntityTable.Header>
        }
        isEmpty={filteredData.length === 0}
        isError={isError}
        emptyMessage={t('No saved queries found')}
      >
        {filteredData.map((query, index) => {
          const isExplore = isExploreSavedQuery(query);
          const isPrebuilt = isExplore && Boolean(query.isPrebuilt);

          return (
            <SavedEntityTable.Row
              key={getSavedQueryKey(query)}
              isFirst={index === 0}
              data-test-id={`table-row-${index}`}
            >
              <SavedEntityTable.Cell hasButton>
                <SavedEntityTable.CellStar
                  isStarred={starredKeys.includes(getSavedQueryKey(query))}
                  onClick={() => debouncedOnClick(query, Boolean(query.starred))}
                />
              </SavedEntityTable.Cell>
              <SavedEntityTable.Cell>
                <SavedEntityTable.CellName
                  to={getSavedQueryTraceItemUrl({savedQuery: query, organization})}
                >
                  {query.name}
                </SavedEntityTable.CellName>
              </SavedEntityTable.Cell>
              {showDatasetColumn && (
                <SavedEntityTable.Cell>
                  {isExploreSavedQuery(query)
                    ? getSavedQueryDatasetLabel(query.dataset)
                    : 'Errors'}
                </SavedEntityTable.Cell>
              )}
              <SavedEntityTable.Cell>
                <SavedEntityTable.CellProjects projects={[...(query.projects ?? [])]} />
              </SavedEntityTable.Cell>
              <SavedEntityTable.Cell>
                <SavedEntityTable.CellEnvironments
                  environments={[...(query.environment ?? [])]}
                />
              </SavedEntityTable.Cell>
              <SavedEntityTable.Cell>
                {isExplore ? (
                  <StyledExploreParams
                    query={query.query[0].query}
                    visualizes={query.query[0].visualize}
                    groupBys={query.query[0].groupby}
                    agent={query.agent}
                  />
                ) : (
                  <StyledExploreParams
                    query={query.query ?? ''}
                    visualizes={getYAxisDiscoverSavedQuery(query)}
                  />
                )}
              </SavedEntityTable.Cell>
              <SavedEntityTable.Cell>
                {isPrebuilt ? (
                  <Tooltip title="Sentry">
                    <ActivityAvatar type="system" size={20} />
                  </Tooltip>
                ) : query.createdBy ? (
                  <UserAvatar user={query.createdBy} hasTooltip />
                ) : null}
              </SavedEntityTable.Cell>
              <SavedEntityTable.Cell>
                <SavedEntityTable.CellTimeSince date={query.lastVisited ?? ''} />
              </SavedEntityTable.Cell>
              <SavedEntityTable.Cell hasButton>
                <SavedEntityTable.CellActions
                  items={[
                    ...(isPrebuilt
                      ? []
                      : [
                          {
                            key: 'rename',
                            label: t('Rename'),
                            onAction: () => {
                              const traceItemDataset = isExplore
                                ? getSavedQueryTraceItemDataset(query.dataset)
                                : TraceItemDataset.ERRORS;
                              if (traceItemDataset === TraceItemDataset.SPANS) {
                                trackAnalytics('trace_explorer.save_query_modal', {
                                  action: 'open',
                                  save_type: 'rename_query',
                                  ui_source: 'table',
                                  organization,
                                });
                              } else if (traceItemDataset === TraceItemDataset.LOGS) {
                                trackAnalytics('logs.save_query_modal', {
                                  action: 'open',
                                  save_type: 'rename_query',
                                  ui_source: 'table',
                                  organization,
                                });
                              }
                              openSaveQueryModal({
                                organization,
                                saveQuery: getHandleUpdateFromSavedQuery(query),
                                name: query.name,
                                source: 'table',
                                traceItemDataset,
                              });
                            },
                          },
                        ]),
                    {
                      key: 'duplicate',
                      label: t('Duplicate'),
                      onAction: async () => {
                        addLoadingMessage(t('Duplicating query...'));
                        try {
                          await duplicateQuery(query);
                          addSuccessMessage(t('Query duplicated'));
                        } catch (error) {
                          addErrorMessage(t('Unable to duplicate query'));
                        }
                      },
                    },
                    ...(isPrebuilt
                      ? []
                      : [
                          {
                            key: 'delete',
                            label: t('Delete'),
                            priority: 'danger' as const,
                            onAction: () => {
                              confirmDeleteSavedQuery({
                                handleDelete: async () => {
                                  addLoadingMessage(t('Deleting query...'));
                                  try {
                                    await deleteQuery({
                                      queryId: Number(query.id),
                                      queryType: query.queryType,
                                    });
                                    addSuccessMessage(t('Query deleted'));
                                  } catch (error) {
                                    addErrorMessage(t('Unable to delete query'));
                                  }
                                },
                                savedQuery: query,
                              });
                            },
                          },
                        ]),
                  ]}
                />
              </SavedEntityTable.Cell>
            </SavedEntityTable.Row>
          );
        })}
      </SavedEntityTable>
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Container>
  );
}

function savedQueryColumns(showDatasetColumn: boolean): TableColumnConfig[] {
  return [
    {key: 'star', width: '40px'},
    {key: 'name', width: {zero: '30%', xl: '20%'}},
    ...(showDatasetColumn
      ? [
          {
            key: 'dataset',
            visible: {xl: true},
            width: 'min-content',
          } satisfies TableColumnConfig,
        ]
      : []),
    {key: 'project', visible: {xl: true}, width: 'minmax(auto, 120px)'},
    {key: 'envs', visible: {'3xl': true}, width: 'minmax(auto, 120px)'},
    {key: 'query', width: 'minmax(0, 1fr)'},
    {key: 'created-by', visible: {xl: true}, width: 'auto'},
    {key: 'last-visited', visible: {'3xl': true}, width: 'auto'},
    {key: 'actions', width: '48px'},
  ];
}

const StyledExploreParams = styled(ExploreParams)`
  overflow: hidden;
  flex-wrap: nowrap;
  margin-bottom: 0;

  span {
    flex-wrap: nowrap;
    overflow: visible;
  }

  div {
    flex-wrap: nowrap;
  }
`;

const TableHeading = styled('h2')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${p => p.theme.font.size.xl};
  margin-top: ${p => p.theme.space['2xl']};
  margin-bottom: ${p => p.theme.space.lg};
`;
