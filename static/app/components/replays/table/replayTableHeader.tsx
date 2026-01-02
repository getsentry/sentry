import {Fragment} from 'react';
import styled from '@emotion/styled';

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
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  columns: readonly ReplayTableColumn[];
  replays: ReplayListRecord[];
  onSortClick?: (key: string) => void;
  sort?: Sort;
  stickyHeader?: boolean;
};

export default function ReplayTableHeader({
  columns,
  replays,
  onSortClick,
  sort,
  stickyHeader,
}: Props) {
  const listItemCheckboxState = useListItemCheckboxContext();
  const {countSelected, isAllSelected, isAnySelected, queryKey, selectAll, selectedIds} =
    listItemCheckboxState;
  const queryOptions = parseQueryKey(queryKey).options;
  const queryString = queryOptions?.query?.query;

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
          <TableCellsRemaining>
            <DeleteReplays
              queryOptions={queryOptions}
              replays={replays}
              selectedIds={selectedIds}
            />
          </TableCellsRemaining>
        </TableHeader>
      ) : null}

      {isAllSelected === 'indeterminate' ? (
        <FullGridAlert variant="warning" system>
          <Flex justify="center" wrap="wrap" gap="md">
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
        <FullGridAlert variant="warning" system>
          <Flex justify="center" wrap="wrap">
            <span>
              {queryString
                ? tct('Selected all replays matching: [queryString].', {
                    queryString: <var>{queryString}</var>,
                  })
                : countSelected > replays.length
                  ? t('Selected all %s+ replays.', replays.length)
                  : tn(
                      'Selected all %s replay.',
                      'Selected all %s replays.',
                      countSelected
                    )}
            </span>
          </Flex>
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

const TableCellsRemaining = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  grid-column: 2 / -1;
`;

const FullGridAlert = styled(Alert)`
  grid-column: 1 / -1;
`;
