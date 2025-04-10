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
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import GridEditable, {
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import {GridHeadCellStatic} from 'sentry/components/gridEditable/styles';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import {FormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useSaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {useStarQuery} from 'sentry/views/explore/hooks/useStarQuery';
import {getExploreUrlFromSavedQueryUrl} from 'sentry/views/explore/utils';
import {StreamlineGridEditable} from 'sentry/views/issueDetails/streamline/eventListTable';

import {useDeleteQuery} from '../hooks/useDeleteQuery';
import {
  type SavedQuery,
  type SortOption,
  useGetSavedQueries,
} from '../hooks/useGetSavedQueries';

const NO_VALUE = ' \u2014 ';

const ORDER: Array<GridColumnOrder<keyof SavedQuery>> = [
  {key: 'name', width: 250, name: t('Name')},
  {key: 'projects', width: 85, name: t('Projects')},
  {key: 'query', width: 500, name: t('Query')},
  {key: 'createdBy', width: 70, name: t('Owner')},
  {key: 'lastVisited', width: 120, name: t('Last Viewed')},
];

type Column = GridColumnHeader<keyof SavedQuery>;

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
  const {projects} = useProjects();
  const location = useLocation();
  const navigate = useNavigate();
  const cursor = decodeScalar(location.query[cursorKey]);
  const {data, isLoading, pageLinks, isFetched} = useGetSavedQueries({
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

  const renderBodyCell = (col: Column, row: SavedQuery) => {
    if (col.key === 'name') {
      const link = getExploreUrlFromSavedQueryUrl({savedQuery: row, organization});
      return (
        <NoOverflow>
          <Link to={link}>{row.name}</Link>
        </NoOverflow>
      );
    }
    if (col.key === 'query') {
      return (
        <FormattedQueryWrapper>
          <FormattedQuery query={row.query[0].query} />
        </FormattedQueryWrapper>
      );
    }
    if (col.key === 'createdBy') {
      return (
        <AlignLeft>
          <Avatar user={row.createdBy} tooltip={row.createdBy.name} hasTooltip />
        </AlignLeft>
      );
    }
    if (col.key === 'projects') {
      const rowProjects = row.projects
        .map(p => projects.find(project => Number(project.id) === p))
        .filter(p => p !== undefined)
        .slice(0, 3);

      return (
        <AlignLeft>
          <StackedProjectBadges>
            {rowProjects.map(project => (
              <ProjectAvatar
                key={project.slug}
                project={project}
                tooltip={project.name}
                hasTooltip
              />
            ))}
          </StackedProjectBadges>
        </AlignLeft>
      );
    }
    if (col.key === 'lastVisited') {
      return (
        <LastColumnWrapper>
          <span>{row.lastVisited ? <TimeSince date={row.lastVisited} /> : NO_VALUE}</span>
          <span>
            <DropdownMenu
              items={[
                {
                  key: 'rename',
                  label: t('Rename'),
                  onAction: () => {
                    openSaveQueryModal({
                      organization,
                      queries: row.query.map((query, queryIndex) => ({
                        query: query.query,
                        groupBys: query.groupby,
                        visualizes: query.visualize.map((v, visualizationIndex) => ({
                          ...v,
                          label: `visualization-${queryIndex}-${visualizationIndex}`,
                        })),
                      })),
                      saveQuery: getHandleUpdateFromSavedQuery(row),
                      name: row.name,
                    });
                  },
                },
                {
                  key: 'duplicate',
                  label: t('Duplicate'),
                  onAction: async () => {
                    addLoadingMessage(t('Duplicating query...'));
                    try {
                      await duplicateQuery(row);
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
                      await deleteQuery(row.id);
                      addSuccessMessage(t('Query deleted'));
                    } catch (error) {
                      addErrorMessage(t('Unable to delete query'));
                    }
                  },
                  priority: 'danger',
                },
              ]}
              trigger={triggerProps => (
                <OptionsButton
                  {...triggerProps}
                  aria-label={t('Query actions')}
                  size="xs"
                  borderless
                  onClick={e => {
                    e.stopPropagation();
                    e.preventDefault();

                    triggerProps.onClick?.(e);
                  }}
                  icon={<IconEllipsis direction="down" size="sm" />}
                  data-test-id="menu-trigger"
                />
              )}
            />
          </span>
        </LastColumnWrapper>
      );
    }
    return <div>{row[col.key]}</div>;
  };

  const renderHeadCell = (col: Column) => {
    if (col.key === 'projects' || col.key === 'createdBy') {
      return <AlignLeft>{col.name}</AlignLeft>;
    }
    if (col.key === 'lastVisited') {
      return <div>{col.name}</div>;
    }
    return <div>{col.name}</div>;
  };

  const renderPrependColumns = (isHeader: boolean, row?: SavedQuery) => {
    if (isHeader) {
      return [<span key="starred-header" />];
    }
    if (!row) {
      return [null];
    }

    const debouncedOnClick = debounce(
      () => {
        if (row.starred) {
          addLoadingMessage(t('Unstarring query...'));
          starQueryHandler(row.id, false);
          addSuccessMessage(t('Query unstarred'));
        } else {
          addLoadingMessage(t('Starring query...'));
          starQueryHandler(row.id, true);
          addSuccessMessage(t('Query starred'));
        }
      },
      1000,
      {leading: true}
    );
    return [
      <AlignLeft key={`starred-${row.id}`}>
        <Button
          aria-label={row.starred ? t('Unstar') : t('Star')}
          size="zero"
          borderless
          icon={
            <IconStar size="sm" color="gray400" isSolid={starredIds.includes(row.id)} />
          }
          onClick={debouncedOnClick}
        />
      </AlignLeft>,
    ];
  };
  return (
    <span>
      <StyledStreamlineGridEditable>
        <GridEditable
          isLoading={isLoading}
          data={filteredData}
          grid={{
            renderBodyCell,
            renderHeadCell,
            renderPrependColumns,
            prependColumnWidths: ['max-content'],
          }}
          columnOrder={ORDER}
          columnSortBy={[]}
          bodyStyle={{overflow: 'visible', zIndex: 'unset'}}
          minimumColWidth={30}
          resizable={false}
        />
      </StyledStreamlineGridEditable>
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </span>
  );
}

const AlignLeft = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
`;

const LastColumnWrapper = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: space-between;
`;

const FormattedQueryWrapper = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  > div {
    flex-wrap: nowrap;
  }
`;

const NoOverflow = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledStreamlineGridEditable = styled(StreamlineGridEditable)`
  ${GridHeadCellStatic}:first-child {
    height: auto;
    padding-left: ${space(1.5)};
  }

  tr:hover > ${InteractionStateLayer} {
    opacity: 0.06;
  }
`;

const OptionsButton = styled(Button)`
  padding: 0 ${space(0.75)};
`;

const StackedProjectBadges = styled('div')`
  display: flex;
  align-items: center;
  & * {
    margin-left: 0;
    margin-right: 0;
    cursor: pointer !important;
  }
  & *:hover {
    z-index: unset;
  }
  & > :not(:first-child) {
    margin-left: -${space(0.5)};
  }
`;
