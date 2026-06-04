import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Flex} from '@sentry/scraps/layout';

import {DeleteReplays} from 'sentry/components/replays/table/deleteReplays';
import {ReplayBulkViewedActions} from 'sentry/components/replays/table/replayBulkViewedActions';
import {
  ReplaySelectColumn,
  type ReplayTableColumn,
} from 'sentry/components/replays/table/replayTableColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import type {ReplayListRecord} from 'sentry/views/explore/replays/types';

type Props = {
  columns: readonly ReplayTableColumn[];
  replays: ReplayListRecord[];
  onSortClick?: (key: string) => void;
  sort?: Sort;
  stickyHeader?: boolean;
};

export function ReplayTableHeader({
  columns,
  replays,
  onSortClick,
  sort,
  stickyHeader,
}: Props) {
  const listItemCheckboxState = useListItemCheckboxContext();
  const {
    countSelected,
    deselectAll,
    isAllSelected,
    isAnySelected,
    endpointOptionsRef,
    selectAll,
    selectedIds,
  } = listItemCheckboxState;
  const endpointOptions = endpointOptionsRef.current;
  const rawQuery = endpointOptions?.query?.query;
  const queryString = typeof rawQuery === 'string' ? rawQuery : undefined;

  const headerStyle: React.CSSProperties = stickyHeader
    ? {position: 'sticky', top: 0}
    : {};

  return (
    <Fragment>
      <TableHeader style={headerStyle}>
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
          <Flex
            align="center"
            column="2 / -1"
            flex="1"
            gap="md"
            justify="start"
            wrap="wrap"
          >
            {selectedIds !== 'all' && (
              <ReplayBulkViewedActions
                deselectAll={deselectAll}
                endpointOptionsRef={endpointOptionsRef}
                replays={replays}
                selectedIds={selectedIds}
              />
            )}
            <DeleteReplays
              queryOptions={endpointOptionsRef.current}
              replays={replays}
              selectedIds={selectedIds}
            />
          </Flex>
        </TableHeader>
      ) : null}

      {isAllSelected === 'indeterminate' ? (
        <FullGridAlert variant="info" system>
          <Flex justify="start" width="100%" wrap="wrap" gap="md">
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
        <FullGridAlert variant="info" system>
          {queryString
            ? tct('Selected all replays matching: [queryString].', {
                queryString: <var>{queryString}</var>,
              })
            : countSelected > replays.length
              ? t('Selected all %s+ replays.', replays.length)
              : tn('Selected all %s replay.', 'Selected all %s replays.', countSelected)}
        </FullGridAlert>
      ) : null}
    </Fragment>
  );
}

const TableHeader = styled(SimpleTable.Header)`
  grid-row: 1;
  z-index: ${p => p.theme.zIndex.initial};
  height: min-content;
`;

const TableCellFirst = styled(SimpleTable.HeaderCell)`
  grid-column: 1;
`;

const FullGridAlert = styled(Alert)`
  grid-column: 1 / -1;
`;
