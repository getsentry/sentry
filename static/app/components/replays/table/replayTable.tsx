import {type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {ReplayTableColumn} from 'sentry/components/replays/table/replayTableColumns';
import {ReplaySessionColumn} from 'sentry/components/replays/table/replayTableColumns';
import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import type RequestError from 'sentry/utils/requestError/requestError';
import {ERROR_MAP} from 'sentry/utils/requestError/requestError';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type ListRecord = ReplayListRecord | ReplayListRecordWithTx;

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
  replays: ListRecord[];
  showDropdownFilters: boolean;
  onClickRow?: (props: {replay: ListRecord; rowIndex: number}) => void;
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
      <ReplayTableWithColumns columns={columns} sort={sort} onSortClick={onSortClick}>
        <SimpleTable.Empty>
          <LoadingIndicator />
        </SimpleTable.Empty>
      </ReplayTableWithColumns>
    );
  }

  if (error) {
    return (
      <ReplayTableWithColumns columns={columns} sort={sort} onSortClick={onSortClick}>
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
    <ReplayTableWithColumns columns={columns} sort={sort} onSortClick={onSortClick}>
      {replays.length === 0 && <SimpleTable.Empty>No data</SimpleTable.Empty>}
      {replays.map((replay, rowIndex) => (
        <SimpleTable.Row
          key={replay.id}
          variant={replay.is_archived ? 'faded' : 'default'}
          onClick={() => onClickRow?.({replay, rowIndex})}
        >
          {columns.map((column, columnIndex) => (
            <RowCell key={`${replay.id}-${column.sortKey}`}>
              <column.Component
                columnIndex={columnIndex}
                replay={replay}
                rowIndex={rowIndex}
                showDropdownFilters={showDropdownFilters}
              />
            </RowCell>
          ))}
        </SimpleTable.Row>
      ))}
    </ReplayTableWithColumns>
  );
}

type TableProps = {
  children: ReactNode;
  columns: readonly ReplayTableColumn[];
  className?: string;
  onSortClick?: (key: string) => void;
  sort?: Sort;
};

const ReplayTableWithColumns = styled(
  ({children, className, columns, onSortClick, sort}: TableProps) => (
    <SimpleTable className={className}>
      <SimpleTable.Header>
        {columns.map(column => (
          <SimpleTable.HeaderCell
            key={column.sortKey}
            handleSortClick={() => column.sortKey && onSortClick?.(column.sortKey)}
            sort={column.sortKey && sort?.field === column.sortKey ? sort : undefined}
            sortKey={column.sortKey}
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

const RowCell = styled(SimpleTable.RowCell)`
  position: relative;
  overflow: auto;

  &:hover [data-visible-on-hover='true'] {
    opacity: 1;
  }
`;
