import type {HTMLAttributes, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {ReplayTableColumn} from 'sentry/components/replays/table/replayTableColumns';
import {ReplaySessionColumn} from 'sentry/components/replays/table/replayTableColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import type RequestError from 'sentry/utils/requestError/requestError';
import {ERROR_MAP} from 'sentry/utils/requestError/requestError';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type SortProps =
  | {
      onSortClick: (key: string) => void;
      sort: Sort;
    }
  | {onSortClick?: never; sort?: never};

type Props = SortProps & {
  columns: readonly ReplayTableColumn[];
  error: RequestError | null | undefined;
  isPending: boolean;
  replays: ReplayListRecord[];
  showDropdownFilters: boolean;
  onClickRow?: (props: {replay: ReplayListRecord; rowIndex: number}) => void;
};

export default function ReplayTable({
  columns,
  error,
  isPending,
  onClickRow,
  onSortClick,
  replays,
  showDropdownFilters,
  sort,
}: Props) {
  if (isPending) {
    return (
      <ReplayTableWithColumns
        data-test-id="replay-table-loading"
        columns={columns}
        sort={sort}
        onSortClick={onSortClick}
      >
        <SimpleTable.Empty>
          <LoadingIndicator />
        </SimpleTable.Empty>
      </ReplayTableWithColumns>
    );
  }

  if (error) {
    return (
      <ReplayTableWithColumns
        data-test-id="replay-table-errored"
        columns={columns}
        sort={sort}
        onSortClick={onSortClick}
      >
        <SimpleTable.Empty>
          <Alert type="error" showIcon>
            {t('Sorry, the list of replays could not be loaded. ')}
            {getErrorMessage(error)}
          </Alert>
        </SimpleTable.Empty>
      </ReplayTableWithColumns>
    );
  }

  return (
    <ReplayTableWithColumns
      data-test-id="replay-table"
      columns={columns}
      sort={sort}
      onSortClick={onSortClick}
    >
      {replays.length === 0 && (
        <SimpleTable.Empty>{t('No replays found')}</SimpleTable.Empty>
      )}
      {replays.map((replay, rowIndex) => {
        const rows = columns.map((column, columnIndex) => (
          <RowCell key={`${replay.id}-${column.sortKey}`}>
            <column.Component
              columnIndex={columnIndex}
              replay={replay}
              rowIndex={rowIndex}
              showDropdownFilters={showDropdownFilters}
            />
          </RowCell>
        ));
        return (
          <SimpleTable.Row
            key={replay.id}
            variant={replay.is_archived ? 'faded' : 'default'}
          >
            {onClickRow ? (
              <RowContentButton as="div" onClick={() => onClickRow({replay, rowIndex})}>
                <InteractionStateLayer />
                {rows}
              </RowContentButton>
            ) : (
              rows
            )}
          </SimpleTable.Row>
        );
      })}
    </ReplayTableWithColumns>
  );
}

type TableProps = {
  children: ReactNode;
  columns: readonly ReplayTableColumn[];
  onSortClick?: (key: string) => void;
  sort?: Sort;
} & HTMLAttributes<HTMLTableElement>;

const ReplayTableWithColumns = styled(
  ({children, columns, onSortClick, sort, ...props}: TableProps) => (
    <SimpleTable {...props}>
      <SimpleTable.Header>
        {columns.map((column, columnIndex) => (
          <SimpleTable.HeaderCell
            key={`${column.name}-${columnIndex}`}
            handleSortClick={() => column.sortKey && onSortClick?.(column.sortKey)}
            sort={
              column.sortKey && sort?.field === column.sortKey ? sort.kind : undefined
            }
          >
            <Tooltip title={column.tooltip} disabled={!column.tooltip}>
              {column.name}
            </Tooltip>
          </SimpleTable.HeaderCell>
        ))}
      </SimpleTable.Header>

      {children}
    </SimpleTable>
  )
)`
  ${p => getGridTemplateColumns(p.columns)}
  margin-bottom: 0;
  overflow: auto;

  [data-clickable='true'] {
    cursor: pointer;
  }
`;

function getGridTemplateColumns(columns: readonly ReplayTableColumn[]) {
  return `grid-template-columns: ${columns
    .map(column =>
      column === ReplaySessionColumn ? 'minmax(150px, 1fr)' : 'max-content'
    )
    .join(' ')};`;
}

function getErrorMessage(fetchError: RequestError) {
  if (typeof fetchError === 'string') {
    return fetchError;
  }
  if (typeof fetchError?.responseJSON?.detail === 'string') {
    return fetchError.responseJSON.detail;
  }
  if (fetchError?.responseJSON?.detail?.message) {
    return fetchError.responseJSON.detail.message;
  }
  if (fetchError.name === ERROR_MAP[500]) {
    return t('There was an internal systems error.');
  }
  return t(
    'This could be due to invalid search parameters or an internal systems error.'
  );
}

const RowContentButton = styled('button')`
  display: contents;
  cursor: pointer;

  border: none;
  background: transparent;
  margin: 0;
  padding: 0;
`;

const RowCell = styled(SimpleTable.RowCell)`
  position: relative;
  overflow: auto;

  &:hover [data-visible-on-hover='true'] {
    opacity: 1;
  }
`;
