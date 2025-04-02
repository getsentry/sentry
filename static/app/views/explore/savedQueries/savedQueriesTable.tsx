import {useCallback} from 'react';
import styled from '@emotion/styled';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import Avatar from 'sentry/components/core/avatar';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {FormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis, IconGlobe, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useSaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {useStarQuery} from 'sentry/views/explore/hooks/useStarQuery';
import {getExploreUrlFromSavedQueryUrl} from 'sentry/views/explore/utils';

import {useDeleteQuery} from '../hooks/useDeleteQuery';
import {type SavedQuery, useGetSavedQueries} from '../hooks/useGetSavedQueries';

const NO_VALUE = ' \u2014 ';

const ORDER: Array<GridColumnOrder<keyof SavedQuery | 'options' | 'access'>> = [
  {key: 'name', width: COL_WIDTH_UNDEFINED, name: t('Name')},
  {key: 'projects', width: COL_WIDTH_UNDEFINED, name: t('Projects')},
  {key: 'query', width: COL_WIDTH_UNDEFINED, name: t('Query')},
  {key: 'createdBy', width: 24, name: t('Owner')},
  {key: 'access', width: 24, name: t('Access')},
  {key: 'lastVisited', width: COL_WIDTH_UNDEFINED, name: t('Last Viewed')},
  {key: 'options', width: 24, name: ''},
];

type Column = GridColumnHeader<keyof SavedQuery | 'options' | 'access'>;

type Props = {
  mode: 'owned' | 'shared';
  perPage?: number;
};

export function SavedQueriesTable({mode, perPage}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {data, isLoading} = useGetSavedQueries({
    sortBy: 'mostPopular',
    exclude: mode === 'owned' ? 'shared' : 'owned', // Inverse because this is an exclusion
    perPage,
  });
  const filteredData = data?.filter(row => row.query?.length > 0) ?? [];
  const {deleteQuery} = useDeleteQuery();
  const {starQuery} = useStarQuery();
  const {updateQueryFromSavedQuery} = useSaveQuery();

  const getHandleUpdateFromSavedQuery = useCallback(
    (savedQuery: SavedQuery) => {
      return (name: string) => {
        return updateQueryFromSavedQuery({...savedQuery, name});
      };
    },
    [updateQueryFromSavedQuery]
  );

  const renderBodyCell = (col: Column, row: SavedQuery) => {
    if (col.key === 'name') {
      const link = getExploreUrlFromSavedQueryUrl({savedQuery: row, organization});
      return (
        <NoOverflow>
          <Link to={link}>{row.name}</Link>
        </NoOverflow>
      );
    }
    if (col.key === 'options') {
      return (
        <Center>
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
              },
              {
                key: 'delete',
                label: t('Delete'),
                onAction: () => {
                  addLoadingMessage(t('Deleting query...'));
                  deleteQuery(row.id);
                  addSuccessMessage(t('Query deleted'));
                },
                priority: 'danger',
              },
            ]}
            trigger={triggerProps => (
              <DropdownTriggerWrapper>
                <Button
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
              </DropdownTriggerWrapper>
            )}
          />
        </Center>
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
        <Center>
          <Avatar user={row.createdBy} tooltip={row.createdBy.name} hasTooltip />
        </Center>
      );
    }
    if (col.key === 'projects') {
      const rowProjects = row.projects
        .map(p => projects.find(project => Number(project.id) === p))
        .filter(p => p !== undefined)
        .slice(0, 3);

      return (
        <Center>
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
        </Center>
      );
    }
    if (col.key === 'lastVisited') {
      return (
        <AlignRight>
          {row.lastVisited ? new Date(row.lastVisited).toDateString() : NO_VALUE}
        </AlignRight>
      );
    }
    if (col.key === 'access') {
      return (
        <Center>
          <Tooltip
            title={
              <span>
                <div>
                  {t('View')}: {t('Everyone')}
                </div>
                <div>
                  {t('Edit')}: {t('Everyone')}
                </div>
              </span>
            }
          >
            <span>
              <IconGlobe size="sm" />
            </span>
          </Tooltip>
        </Center>
      );
    }
    return <div>{row[col.key]}</div>;
  };

  const renderHeadCell = (col: Column) => {
    if (col.key === 'projects' || col.key === 'createdBy' || col.key === 'access') {
      return <Center>{col.name}</Center>;
    }
    if (col.key === 'lastVisited') {
      return <AlignRight>{col.name}</AlignRight>;
    }
    return <div>{col.name}</div>;
  };

  const renderPrependColumns = (isHeader: boolean, row?: SavedQuery) => {
    if (isHeader) {
      return [
        <IconStar
          color="yellow300"
          isSolid
          aria-label={t('Starred Queries')}
          key="starred-header"
        />,
      ];
    }
    if (!row) {
      return [null];
    }
    return [
      <Center key={`starred-${row.id}`}>
        <Button
          aria-label={row.starred ? t('Unstar') : t('Star')}
          size="zero"
          borderless
          icon={
            <IconStar
              size="sm"
              color={row.starred ? 'yellow300' : 'gray300'}
              isSolid={row.starred}
            />
          }
          onClick={() => {
            if (row.starred) {
              addLoadingMessage(t('Unstarring query...'));
              starQuery(row.id, false);
              addSuccessMessage(t('Query unstarred'));
            } else {
              addLoadingMessage(t('Starring query...'));
              starQuery(row.id, true);
              addSuccessMessage(t('Query starred'));
            }
          }}
        />
      </Center>,
    ];
  };
  return (
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
    />
  );
}

const Center = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
`;

const AlignRight = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
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

const DropdownTriggerWrapper = styled('div')`
  width: 20px;
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
