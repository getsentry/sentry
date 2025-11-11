import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip/tooltip';

import {Alert} from 'sentry/components/core/alert';
import {Flex} from 'sentry/components/core/layout/flex';
import DeleteReplays from 'sentry/components/replays/table/deleteReplays';
import {
  ReplaySelectColumn,
  type ReplayTableColumn,
} from 'sentry/components/replays/table/replayTableColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {parseQueryKey} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import useDeleteReplayHasAccess from 'sentry/utils/replays/hooks/useDeleteReplayHasAccess';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  columns: readonly ReplayTableColumn[];
  replays: ReplayListRecord[];
  onSortClick?: (key: string) => void;
  sort?: Sort;
};

export default function ReplayTableHeader({columns, replays, onSortClick, sort}: Props) {
  const listItemCheckboxState = useListItemCheckboxContext();
  const {countSelected, isAllSelected, isAnySelected, queryKey, selectAll, selectedIds} =
    listItemCheckboxState;
  const queryOptions = parseQueryKey(queryKey).options;
  const queryString = queryOptions?.query?.query;

  const {project: selectedProjectIds} = useLocationQuery({
    fields: {
      project: decodeList,
    },
  });
  const {projects} = useProjects();
  const hasOnlyOneProject = projects.length === 1;

  // if 1 project is selected, use it
  // if no project is selected but only 1 project exists, use that
  const project = useProjectFromId({
    project_id:
      selectedProjectIds.length === 1
        ? selectedProjectIds[0]
        : hasOnlyOneProject
          ? projects[0]?.id
          : undefined,
  });

  const hasAccess = useDeleteReplayHasAccess({project});
  const hasOneProjectSelected = Boolean(project);
  const oneProjectEligible = hasOneProjectSelected || hasOnlyOneProject;

  const disabledMessage = oneProjectEligible
    ? hasAccess
      ? undefined
      : t('You must have project:write or project:admin access to delete replays')
    : t('Select a single project from the dropdown to delete replays');

  return (
    <Fragment>
      <TableHeader>
        {columns.map(({Header, sortKey}, columnIndex) => (
          <SimpleTable.HeaderCell
            key={`${sortKey}-${columnIndex}`}
            handleSortClick={
              onSortClick && sortKey ? () => onSortClick(sortKey) : undefined
            }
            sort={sortKey && sort?.field === sortKey ? sort.kind : undefined}
          >
            {typeof Header === 'function'
              ? Header({columnIndex, listItemCheckboxState, replays})
              : Header}
          </SimpleTable.HeaderCell>
        ))}
      </TableHeader>

      {isAnySelected ? (
        <TableHeader>
          <TableCellFirst>
            <ReplaySelectColumn.Header
              columnIndex={0}
              listItemCheckboxState={listItemCheckboxState}
              replays={replays}
            />
          </TableCellFirst>
          <TableCellsRemaining>
            <Tooltip disabled={!disabledMessage} title={disabledMessage}>
              {project ? (
                <DeleteReplays
                  disabled={!oneProjectEligible || !hasAccess}
                  project={project}
                  queryOptions={queryOptions}
                  replays={replays}
                  selectedIds={selectedIds}
                />
              ) : null}
            </Tooltip>
          </TableCellsRemaining>
        </TableHeader>
      ) : null}

      {isAllSelected === 'indeterminate' ? (
        <FullGridAlert type="warning" system>
          <Flex justify="center" wrap="wrap" gap="sm">
            {tn(
              'Selected %s visible replay.',
              'Selected %s visible replays.',
              countSelected
            )}
            <a onClick={selectAll}>
              {queryString
                ? tct('Select all replays that match: [queryString].', {
                    queryString: <var>{queryString}</var>,
                  })
                : t('Select all replays.')}
            </a>
          </Flex>
        </FullGridAlert>
      ) : null}

      {isAllSelected === true ? (
        <FullGridAlert type="warning" system>
          {queryString
            ? tct('Selected all replays matching: [queryString].', {
                queryString: <var>{queryString}</var>,
              })
            : countSelected > replays.length
              ? t('Selected all %s+ replays.', replays.length)
              : tn('Selected all %s replay.', 'Selected all %s replays.', countSelected)}
        </FullGridAlert>
      ) : null}

      {isAllSelected && disabledMessage ? (
        <FullGridAlert type="error" system>
          {disabledMessage}
        </FullGridAlert>
      ) : null}
    </Fragment>
  );
}

const TableHeader = styled(SimpleTable.Header)`
  grid-row: 1;
  z-index: ${p => p.theme.zIndex.initial};
`;

const TableCellFirst = styled(SimpleTable.HeaderCell)`
  grid-column: 1;
`;

const TableCellsRemaining = styled('div')`
  margin-left: ${p => p.theme.space.lg};
  display: flex;
  align-items: center;
  flex: 1;
  grid-column: 2 / -1;
`;

const FullGridAlert = styled(Alert)`
  grid-column: 1 / -1;
  text-align: center;
`;
