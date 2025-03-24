import styled from '@emotion/styled';

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
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';

import {useDeleteQuery} from '../hooks/useDeleteQuery';
import {type SavedQuery, useGetSavedQueries} from '../hooks/useGetSavedQueries';

const NO_VALUE = ' \u2014 ';

const ORDER: Array<GridColumnOrder<keyof SavedQuery | 'options' | 'access'>> = [
  {key: 'name', width: COL_WIDTH_UNDEFINED, name: t('Name')},
  {key: 'projects', width: COL_WIDTH_UNDEFINED, name: t('Projects')},
  {key: 'query', width: COL_WIDTH_UNDEFINED, name: t('Query')},
  {key: 'createdBy', width: COL_WIDTH_UNDEFINED, name: t('Owner')},
  {key: 'access', width: COL_WIDTH_UNDEFINED, name: t('Access')},
  {key: 'lastVisited', width: COL_WIDTH_UNDEFINED, name: t('Last Viewed')},
  {key: 'options', width: COL_WIDTH_UNDEFINED, name: ''},
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
  const {deleteQuery} = useDeleteQuery();
  const renderBodyCell = (col: Column, row: SavedQuery) => {
    if (col.key === 'name') {
      return (
        <NoOverflow>
          <Link
            to={getExploreUrl({
              organization,
              ...row,
              title: row.name,
              mode: row.mode as Mode,
              selection: {
                datetime: {end: row.end, period: row.range, start: row.start, utc: null},
                environments: row.environment,
                projects: row.projects,
              },
            })}
          >
            {row.name}
          </Link>
        </NoOverflow>
      );
    }
    if (col.key === 'options') {
      return (
        <Center>
          <DropdownMenu
            items={[
              // TODO
              {
                key: 'rename',
                label: t('Rename'),
              },
              {
                key: 'share',
                label: t('Share'),
              },
              {
                key: 'duplicate',
                label: t('Duplicate'),
              },
              {
                key: 'delete',
                label: t('Delete'),
                onAction: () => deleteQuery(row.id),
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
          <FormattedQuery query={row.query} />
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
        <Center>
          {row.lastVisited ? new Date(row.lastVisited).toDateString() : NO_VALUE}
        </Center>
      );
    }
    // TODO
    if (col.key === 'access') {
      return <Center>{NO_VALUE}</Center>;
    }
    // We don't actually use this column, but we return null here to prevent typescript from complaining
    if (col.key === 'visualize') {
      return null;
    }
    return <div>{row[col.key]}</div>;
  };

  const renderHeadCell = (col: Column) => {
    if (col.key === 'projects' || col.key === 'createdBy') {
      return <Center>{col.name}</Center>;
    }
    return <div>{col.name}</div>;
  };

  return (
    <GridEditable
      isLoading={isLoading}
      data={data ?? []}
      grid={{renderBodyCell, renderHeadCell}}
      columnOrder={ORDER}
      columnSortBy={[]}
    />
  );
}

const Center = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
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
