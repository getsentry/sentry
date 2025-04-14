import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import Avatar from 'sentry/components/core/avatar';
import {ExploreParams} from 'sentry/components/modals/explore/saveQueryModal';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
import {getExploreUrlFromSavedQueryUrl} from 'sentry/views/explore/utils';

type Props = {
  cursorKey?: string;
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
    [starQuery]
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

  const debouncedOnClick = debounce(
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
  );

  return (
    <span>
      <SavedEntityTableWithColumns
        pageSize={perPage}
        isLoading={isLoading}
        header={
          <SavedEntityTable.Header>
            <SavedEntityTable.HeaderCell key="star" />
            <SavedEntityTable.HeaderCell key="name">
              {t('Name')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell key="project">
              {t('Project')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell key="envs">
              {t('Envs')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell key="query">
              {t('Query')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell key="created-by">
              {t('Creator')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell key="last-visited">
              {t('Last Viewed')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell key="actions" />
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
            <SavedEntityTable.Cell>
              <SavedEntityTable.CellStar
                isStarred={starredIds.includes(query.id)}
                onClick={() => debouncedOnClick(query.id, query.starred)}
              />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell>
              <SavedEntityTable.CellName
                to={getExploreUrlFromSavedQueryUrl({savedQuery: query, organization})}
              >
                {query.name}
              </SavedEntityTable.CellName>
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell>
              <SavedEntityTable.CellProjects projects={query.projects} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell>
              <SavedEntityTable.CellEnvironments environments={query.environment} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell>
              <StyledExploreParams
                query={query.query[0].query}
                visualizes={query.query[0].visualize}
                groupBys={query.query[0].groupby}
              />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell>
              <Avatar user={query.createdBy} tooltip={query.createdBy.name} hasTooltip />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell>
              <SavedEntityTable.CellTimeSince date={query.lastVisited} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell>
              <SavedEntityTable.CellActions
                items={[
                  {
                    key: 'rename',
                    label: t('Rename'),
                    onAction: () => {
                      openSaveQueryModal({
                        organization,
                        queries: query.query.map((q, qIndex) => ({
                          query: q.query,
                          groupBys: q.groupby,
                          visualizes: q.visualize.map((v, vIndex) => ({
                            ...v,
                            label: `visualization-${qIndex}-${vIndex}`,
                          })),
                        })),
                        saveQuery: getHandleUpdateFromSavedQuery(query),
                        name: query.name,
                      });
                    },
                  },
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
                  {
                    key: 'delete',
                    label: t('Delete'),
                    onAction: async () => {
                      addLoadingMessage(t('Deleting query...'));
                      try {
                        await deleteQuery(query.id);
                        addSuccessMessage(t('Query deleted'));
                      } catch (error) {
                        addErrorMessage(t('Unable to delete query'));
                      }
                    },
                    priority: 'danger',
                  },
                ]}
              />
            </SavedEntityTable.Cell>
          </SavedEntityTable.Row>
        ))}
      </SavedEntityTableWithColumns>
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </span>
  );
}

const SavedEntityTableWithColumns = styled(SavedEntityTable)`
  grid-template-columns:
    40px 20% minmax(auto, 120px) minmax(auto, 120px) minmax(0, 1fr)
    minmax(auto, 120px)
    auto 60px;

  button {
    min-height: unset;
    height: auto;
    padding: ${space(0.5)} ${space(1)};
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
