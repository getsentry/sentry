import * as ReplayTableColumns from 'sentry/components/replays/table/replayTableColumns';
import type {Sort} from 'sentry/utils/discover/fields';
import SortableHeader from 'sentry/views/replays/replayTable/sortableHeader';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';

type Props = {
  column: ReplayColumn;
  sort?: Sort;
};

export default function HeaderCell({column, sort}: Props) {
  const tableColumn = {
    [ReplayColumn.ACTIVITY]: ReplayTableColumns.ReplayActivityColumn,
    [ReplayColumn.BROWSER]: ReplayTableColumns.ReplayBrowserColumn,
    [ReplayColumn.COUNT_DEAD_CLICKS]: ReplayTableColumns.ReplayCountDeadClicksColumn,
    [ReplayColumn.COUNT_ERRORS]: ReplayTableColumns.ReplayCountErrorsColumn,
    [ReplayColumn.COUNT_RAGE_CLICKS]: ReplayTableColumns.ReplayCountRageClicksColumn,
    [ReplayColumn.DURATION]: ReplayTableColumns.ReplayDurationColumn,
    [ReplayColumn.OS]: ReplayTableColumns.ReplayOSColumn,
    [ReplayColumn.PLAY_PAUSE]: ReplayTableColumns.ReplayPlayPauseColumn,
    [ReplayColumn.REPLAY]: ReplayTableColumns.ReplaySessionColumn,
    [ReplayColumn.SLOWEST_TRANSACTION]: ReplayTableColumns.ReplaySlowestTransactionColumn,
  }[column];

  if (!tableColumn) {
    return null;
  }

  return (
    <SortableHeader
      sort={sort}
      fieldName={tableColumn.sortKey}
      label={tableColumn.name}
      tooltip={tableColumn.tooltip}
    />
  );
}
