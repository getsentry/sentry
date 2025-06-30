import styled from '@emotion/styled';

import * as ReplayTableColumns from 'sentry/components/replays/table/replayTableColumns';
import {space} from 'sentry/styles/space';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  replay: ReplayListRecord | ReplayListRecordWithTx;
  rowIndex: number;
  showDropdownFilters?: boolean;
};

export function ReplayCell({replay, rowIndex, showDropdownFilters}: Props) {
  return (
    <Item isArchived={replay.is_archived} isReplayCell>
      {ReplayTableColumns.ReplaySessionColumn.Component({
        replay,
        rowIndex,
        columnIndex: 0,
        showDropdownFilters: showDropdownFilters ?? false,
      })}
    </Item>
  );
}

export function TransactionCell({replay, rowIndex, showDropdownFilters}: Props) {
  const hasTxEvent = 'txEvent' in replay;

  if (!hasTxEvent) {
    return null;
  }

  return (
    <Item isArchived={replay.is_archived}>
      {ReplayTableColumns.ReplaySlowestTransactionColumn.Component({
        replay,
        rowIndex,
        columnIndex: 0,
        showDropdownFilters: showDropdownFilters ?? false,
      })}
    </Item>
  );
}

export function OSCell({replay, rowIndex, showDropdownFilters}: Props) {
  return (
    <Item isArchived={replay.is_archived}>
      {ReplayTableColumns.ReplayOSColumn.Component({
        replay,
        rowIndex,
        columnIndex: 0,
        showDropdownFilters: showDropdownFilters ?? false,
      })}
    </Item>
  );
}

export function BrowserCell({replay, rowIndex, showDropdownFilters}: Props) {
  return (
    <Item isArchived={replay.is_archived}>
      {ReplayTableColumns.ReplayBrowserColumn.Component({
        replay,
        rowIndex,
        columnIndex: 0,
        showDropdownFilters: showDropdownFilters ?? false,
      })}
    </Item>
  );
}

export function DurationCell({replay, rowIndex, showDropdownFilters}: Props) {
  return (
    <Item isArchived={replay.is_archived}>
      {ReplayTableColumns.ReplayDurationColumn.Component({
        replay,
        rowIndex,
        columnIndex: 0,
        showDropdownFilters: showDropdownFilters ?? false,
      })}
    </Item>
  );
}

export function RageClickCountCell({replay, rowIndex, showDropdownFilters}: Props) {
  return (
    <Item data-test-id="replay-table-count-rage-clicks" isArchived={replay.is_archived}>
      {ReplayTableColumns.ReplayCountRageClicksColumn.Component({
        replay,
        rowIndex,
        columnIndex: 0,
        showDropdownFilters: showDropdownFilters ?? false,
      })}
    </Item>
  );
}

export function DeadClickCountCell({replay, rowIndex, showDropdownFilters}: Props) {
  return (
    <Item data-test-id="replay-table-count-dead-clicks" isArchived={replay.is_archived}>
      {ReplayTableColumns.ReplayCountDeadClicksColumn.Component({
        replay,
        rowIndex,
        columnIndex: 0,
        showDropdownFilters: showDropdownFilters ?? false,
      })}
    </Item>
  );
}

export function ErrorCountCell({replay, rowIndex, showDropdownFilters}: Props) {
  return (
    <Item data-test-id="replay-table-count-errors" isArchived={replay.is_archived}>
      {ReplayTableColumns.ReplayCountErrorsColumn.Component({
        replay,
        rowIndex,
        columnIndex: 0,
        showDropdownFilters: showDropdownFilters ?? false,
      })}
    </Item>
  );
}

export function ActivityCell({replay, rowIndex, showDropdownFilters}: Props) {
  return (
    <Item isArchived={replay.is_archived}>
      {ReplayTableColumns.ReplayActivityColumn.Component({
        replay,
        rowIndex,
        columnIndex: 0,
        showDropdownFilters: showDropdownFilters ?? false,
      })}
    </Item>
  );
}

export function PlayPauseCell({replay, rowIndex, showDropdownFilters}: Props) {
  return (
    <Item>
      {ReplayTableColumns.ReplayPlayPauseColumn.Component({
        replay,
        rowIndex,
        columnIndex: 0,
        showDropdownFilters: showDropdownFilters ?? false,
      })}
    </Item>
  );
}

const Item = styled('div')<{
  isArchived?: boolean;
  isReplayCell?: boolean;
  isWidget?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  ${p =>
    p.isWidget
      ? `padding: ${space(0.75)} ${space(1.5)} ${space(1.5)} ${space(1.5)};`
      : `padding: ${space(1.5)};`};
  ${p => (p.isArchived ? 'opacity: 0.5;' : '')};
  ${p => (p.isReplayCell ? 'overflow: auto;' : '')};

  &:hover [data-visible-on-hover='true'] {
    opacity: 1;
  }
`;
