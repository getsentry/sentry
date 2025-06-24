import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type RequestError from 'sentry/utils/requestError/requestError';
import {ERROR_MAP} from 'sentry/utils/requestError/requestError';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import {
  ActivityCell,
  BrowserCell,
  DeadClickCountCell,
  DurationCell,
  ErrorCountCell,
  OSCell,
  PlayPauseCell,
  RageClickCountCell,
  ReplayCell,
  TransactionCell,
} from 'sentry/views/replays/replayTable/tableCell';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type ListRecord = ReplayListRecord | ReplayListRecordWithTx;

interface Props {
  columns: Array<GridColumnOrder<ReplayColumn>>;
  error: RequestError | null | undefined;
  isPending: boolean;
  replays: ListRecord[];
  showDropdownFilters: boolean;
}

export default function ReplayTable({
  columns,
  error,
  isPending,
  replays,
  // showDropdownFilters,
}: Props) {
  if (isPending) {
    return (
      <ReplayTableWithColumns columns={columns}>
        <SimpleTable.Empty>
          <LoadingIndicator />
        </SimpleTable.Empty>
      </ReplayTableWithColumns>
    );
  }

  if (error) {
    return (
      <ReplayTableWithColumns columns={columns}>
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
    <ReplayTableWithColumns columns={columns}>
      {replays.length === 0 && <SimpleTable.Empty>No data</SimpleTable.Empty>}
      {replays.map(replay => (
        <SimpleTable.Row key={replay.id}>
          {columns.map(column => (
            <SimpleTable.RowCell key={`${replay.id}-${column.key}`} name={column.key}>
              {renderBodyCell(column, replay, 0, 0)}
            </SimpleTable.RowCell>
          ))}
        </SimpleTable.Row>
      ))}
    </ReplayTableWithColumns>
  );
}

const ReplayTableWithColumns = styled(
  ({
    children,
    className,
    columns,
  }: {
    children: ReactNode;
    columns: Array<GridColumnOrder<ReplayColumn>>;
    className?: string;
  }) => (
    <SimpleTable className={className}>
      <SimpleTable.Header>
        {columns.map(column => (
          <SimpleTable.HeaderCell key={column.key} name={column.key} sortKey={column.key}>
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
  grid-template-columns: 1fr repeat(7, max-content);
`;

function renderBodyCell(
  column: GridColumnOrder<ReplayColumn>,
  replay: ListRecord,
  _rowIndex: number,
  _columnIndex: number
) {
  const showDropdownFilters = true;
  switch (column.key) {
    case ReplayColumn.ACTIVITY:
      return (
        <ActivityCell
          key="activity"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
        />
      );

    case ReplayColumn.BROWSER:
      return (
        <BrowserCell
          key="browser"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
        />
      );

    case ReplayColumn.COUNT_DEAD_CLICKS:
      return (
        <DeadClickCountCell
          key="countDeadClicks"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
        />
      );

    case ReplayColumn.COUNT_ERRORS:
      return (
        <ErrorCountCell
          key="countErrors"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
        />
      );

    case ReplayColumn.COUNT_RAGE_CLICKS:
      return (
        <RageClickCountCell
          key="countRageClicks"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
        />
      );

    case ReplayColumn.DURATION:
      return (
        <DurationCell
          key="duration"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
        />
      );

    case ReplayColumn.OS:
      return (
        <OSCell key="os" replay={replay} showDropdownFilters={showDropdownFilters} />
      );

    case ReplayColumn.REPLAY:
      return <ReplayCell key="session" replay={replay} referrerTable="main" />;

    case ReplayColumn.PLAY_PAUSE:
      return <PlayPauseCell key="play" isSelected={false} handleClick={() => {}} />;

    case ReplayColumn.SLOWEST_TRANSACTION:
      return <TransactionCell key="slowestTransaction" replay={replay} />;

    default:
      return null;
  }
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
