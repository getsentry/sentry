import type {ReactNode} from 'react';
import {error} from 'node:console';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import useQueryBasedColumnResize from 'sentry/components/gridEditable/useQueryBasedColumnResize';
import type {Sort} from 'sentry/utils/discover/fields';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import type {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type ListRecord = ReplayListRecord | ReplayListRecordWithTx;

interface Props {
  columns: Array<GridColumnOrder<ReplayColumn>>;
  error: RequestError | null;
  isPending: boolean;
  replays: ListRecord[];
  cursorKeyName?: string;
  highlightedRowKey?: number;
  onResizeColumn?: (
    columnIndex: number,
    nextColumn: GridColumnOrder<ReplayColumn>
  ) => void;
  onRowMouseOut?: (dataRow: ListRecord, key: number) => void;
  onRowMouseOver?: (dataRow: ListRecord, key: number) => void;
  scrollable?: boolean;
}

export default function ReplayTable({
  columns,
  emptyMessage,
  error,
  gridRows,
  isPending,
  onResizeColumn,
  replays,
  sort,
}: Props) {
  const location = useLocation();
  const {columns: columnOrder, handleResizeColumn} =
    useQueryBasedColumnResize<ReplayColumn>({
      columns,
      location,
    });

  return (
    <GridEditable
      error={error}
      isLoading={isPending}
      data={replays ?? []}
      columnOrder={columnOrder}
      columnSortBy={[]}
      grid={{
        renderBodyCell,
        onResizeColumn: handleResizeColumn,
      }}
      scrollable
    />
  );
}

function renderBodyCell(
  column: GridColumnOrder<ReplayColumn>,
  dataRow: ListRecord,
  _rowIndex: number,
  _columnIndex: number
) {
  switch (column.key) {
    case 'flag':
      return <code>{dataRow.flag}</code>;
    case 'provider':
      return dataRow.provider || t('unknown');
    case 'createdAt':
      return FIELD_FORMATTERS.date.renderFunc('createdAt', dataRow);
    case 'action': {
      return getFlagActionLabel(dataRow.action);
    }
    default:
      return dataRow[column.key];
  }
}
