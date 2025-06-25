import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Tooltip} from 'sentry/components/core/tooltip';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useDeleteQuery} from 'sentry/views/explore/hooks/useDeleteQuery';
import {
  type SavedQuery,
  type SortOption,
  useGetSavedQueries,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useSaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {useStarQuery} from 'sentry/views/explore/hooks/useStarQuery';
import {ExploreParams} from 'sentry/views/explore/savedQueries/exploreParams';
import {
  confirmDeleteSavedQuery,
  getExploreUrlFromSavedQueryUrl,
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
  const cursor = decodeScalar(location.query[cursorKey]);
  const {data, isLoading, pageLinks, isFetched, isError} = useGetSavedQueries({
    sortBy: ['starred', sort],
    exclude: mode === 'owned' ? 'shared' : mode === 'shared' ? 'owned' : undefined, // Inverse because this is an exclusion
    perPage,
    cursor,
    query: searchQuery,
  });
  const filteredData = data?.filter(row => row.query?.length > 0) ?? [];
  const {deleteQuery} = useDeleteQuery();
  const {starQuery} = useStarQuery();
  const {saveQueryFromSavedQuery, updateQueryFromSavedQuery} = useSaveQuery();

  const [starredIds, setStarredIds] = useState<number[]>([]);

  // Initialize starredIds state when queries have been fetched
  useEffect(() => {
    if (isFetched === true) {
      setStarredIds(data?.filter(row => row.starred).map(row => row.id) ?? []);
    }
  }, [isFetched, data]);

  const starQueryHandler = useCallback(
    (id: number, starred: boolean) => {
      if (starred) {
        setStarredIds(prev => [...prev, id]);
      } else {
        setStarredIds(prev => prev.filter(starredId => starredId !== id));
      }
      trackAnalytics('trace_explorer.star_query', {
        save_type: starred ? 'star_query' : 'unstar_query',
        ui_source: 'table',
        organization,
      });
      starQuery(id, starred).catch(() => {
        // If the starQuery call fails, we need to revert the starredIds state
        addErrorMessage(t('Unable to star query'));
        if (starred) {
          setStarredIds(prev => prev.filter(starredId => starredId !== id));
        } else {
          setStarredIds(prev => [...prev, id]);
        }
      });
    },
    [starQuery, organization]
  );

  const getHandleUpdateFromSavedQuery = useCallback(
    (savedQuery: SavedQuery) => {
      return (name: string) => {
        return updateQueryFromSavedQuery({...savedQuery, name});
      };
    },
    [updateQueryFromSavedQuery]
  );

  const duplicateQuery = async (savedQuery: SavedQuery) => {
    await saveQueryFromSavedQuery({
      ...savedQuery,
      name: `${savedQuery.name} (Copy)`,
    });
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
        (id, starred) => {
          if (starred) {
            addLoadingMessage(t('Unstarring query...'));
            starQueryHandler(id, false);
            addSuccessMessage(t('Query unstarred'));
          } else {
            addLoadingMessage(t('Starring query...'));
            starQueryHandler(id, true);
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
    <Container>
      <TableHeading>{title}</TableHeading>
      <SavedEntityTableWithColumns
        pageSize={perPage}
        isLoading={isLoading}
        header={
          <SavedEntityTable.Header>
            <SavedEntityTable.HeaderCell data-column="star" />
            <SavedEntityTable.HeaderCell data-column="name">
              {t('Name')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="project">
              {t('Project')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="envs">
              {t('Envs')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="query">
              {t('Query')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="created-by">
              {t('Creator')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="last-visited" noBorder>
              {t('Last Viewed')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="actions" />
          </SavedEntityTable.Header>
        }
        isEmpty={filteredData.length === 0}
        isError={isError}
        emptyMessage={t('No saved queries found')}
      >
        {filteredData.map((query, index) => (
          <SavedEntityTable.Row
            key={query.id}
            isFirst={index === 0}
            data-test-id={`table-row-${index}`}
          >
            <SavedEntityTable.Cell hasButton data-column="star">
              <SavedEntityTable.CellStar
                isStarred={starredIds.includes(query.id)}
                onClick={() => debouncedOnClick(query.id, query.starred)}
              />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="name">
              <SavedEntityTable.CellName
                to={getExploreUrlFromSavedQueryUrl({savedQuery: query, organization})}
              >
                {query.name}
              </SavedEntityTable.CellName>
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="project">
              <SavedEntityTable.CellProjects projects={query.projects} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="envs">
              <SavedEntityTable.CellEnvironments environments={query.environment ?? []} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="query">
              <StyledExploreParams
                query={query.query[0].query}
                visualizes={query.query[0].visualize}
                groupBys={query.query[0].groupby}
              />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="created-by">
              {query.isPrebuilt ? (
                <Tooltip title={'Sentry'}>
                  <ActivityAvatar type="system" size={20} />
                </Tooltip>
              ) : query.createdBy ? (
                <UserAvatar user={query.createdBy} hasTooltip />
              ) : null}
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="last-visited">
              <SavedEntityTable.CellTimeSince date={query.lastVisited} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="actions" hasButton>
              <SavedEntityTable.CellActions
                items={[
                  ...(query.isPrebuilt
                    ? []
                    : [
                        {
                          key: 'rename',
                          label: t('Rename'),
                          onAction: () => {
                            trackAnalytics('trace_explorer.save_query_modal', {
                              action: 'open',
                              save_type: 'rename_query',
                              ui_source: 'table',
                              organization,
                            });
                            openSaveQueryModal({
                              organization,
                              saveQuery: getHandleUpdateFromSavedQuery(query),
                              name: query.name,
                              source: 'table',
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
                  ...(query.isPrebuilt
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
                                  await deleteQuery(query.id);
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
        ))}
      </SavedEntityTableWithColumns>
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Container>
  );
}

const Container = styled('div')`
  container-type: inline-size;
`;

const SavedEntityTableWithColumns = styled(SavedEntityTable)`
  grid-template-areas: 'star name project envs query created-by last-visited actions';
  grid-template-columns:
    40px 20% minmax(auto, 120px) minmax(auto, 120px) minmax(0, 1fr)
    auto auto 48px;

  @container (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-areas: 'star name project query created-by actions';
    grid-template-columns: 40px 20% minmax(auto, 120px) minmax(0, 1fr) auto 48px;

    div[data-column='envs'],
    div[data-column='last-visited'],
    div[data-column='created'],
    div[data-column='stars'] {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-areas: 'star name query actions';
    grid-template-columns: 40px 30% minmax(0, 1fr) 48px;

    div[data-column='envs'],
    div[data-column='last-visited'],
    div[data-column='created'],
    div[data-column='stars'],
    div[data-column='created-by'],
    div[data-column='project'] {
      display: none;
    }
  }
`;

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
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-top: ${space(3)};
  margin-bottom: ${space(1.5)};
`;
