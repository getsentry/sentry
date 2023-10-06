import {ReactNode, useCallback, useMemo} from 'react';
import {Location} from 'history';

import GridEditable from 'sentry/components/gridEditable';
import renderSortableHeaderCell from 'sentry/components/replays/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/replays/useQueryBasedSorting';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import {colToHeader} from 'sentry/views/replays/replayTable/headerCell';
import {
  ActivityCell,
  BrowserCell,
  DeadClickCountCell,
  DurationCell,
  ErrorCountCell,
  OSCell,
  RageClickCountCell,
  ReplayCell,
  TransactionCell,
} from 'sentry/views/replays/replayTable/tableCell';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  fetchError: undefined | Error;
  isFetching: boolean;
  replays: undefined | ReplayListRecord[] | ReplayListRecordWithTx[];
  sort: Sort | undefined;
  visibleColumns: ReplayColumn[];
  emptyMessage?: ReactNode;
  gridRows?: string;
  saveLocation?: boolean;
  showDropdownFilters?: boolean;
};

function ReplayTable({
  fetchError,
  isFetching,
  replays,
  visibleColumns,
  emptyMessage,
  saveLocation,
  showDropdownFilters,
}: Props) {
  const routes = useRoutes();
  const referrer = getRouteStringFromRoutes(routes);
  const newLocation = useLocation();
  const organization = useOrganization();
  const location: Location = saveLocation
    ? {
        pathname: '',
        search: '',
        query: {},
        hash: '',
        state: '',
        action: 'PUSH',
        key: '',
      }
    : newLocation;

  const eventView = EventView.fromLocation(location);

  const gridCols = visibleColumns.map(c => {
    return {key: c, name: colToHeader[c]};
  });
  const {columns} = useQueryBasedColumnResize({
    columns: gridCols,
    location: newLocation,
  });
  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: gridCols[0].key, kind: 'desc'},
    location: newLocation,
  });
  const renderHeadCell = useMemo(
    () =>
      renderSortableHeaderCell({
        currentSort,
        makeSortLinkGenerator,
        onClick: () => {},
        rightAlignedColumns: [],
        sortableColumns: gridCols,
      }),
    [currentSort, gridCols, makeSortLinkGenerator]
  );

  const renderBodyCell = useCallback(
    (column, dataRow) => {
      const replay = dataRow;
      switch (column.key) {
        case ReplayColumn.ACTIVITY:
          return (
            <ActivityCell
              key="activity"
              replay={replay}
              showDropdownFilters={showDropdownFilters}
              noPadding
            />
          );

        case ReplayColumn.BROWSER:
          return (
            <BrowserCell
              key="browser"
              replay={replay}
              showDropdownFilters={showDropdownFilters}
              noPadding
            />
          );

        case ReplayColumn.COUNT_DEAD_CLICKS:
          return (
            <DeadClickCountCell
              key="countDeadClicks"
              replay={replay}
              showDropdownFilters={showDropdownFilters}
              noPadding
            />
          );

        case ReplayColumn.COUNT_DEAD_CLICKS_NO_HEADER:
          return (
            <DeadClickCountCell
              key="countDeadClicks"
              replay={replay}
              showDropdownFilters={false}
              noPadding
            />
          );

        case ReplayColumn.COUNT_ERRORS:
          return (
            <ErrorCountCell
              key="countErrors"
              replay={replay}
              showDropdownFilters={showDropdownFilters}
              noPadding
            />
          );

        case ReplayColumn.COUNT_RAGE_CLICKS:
          return (
            <RageClickCountCell
              key="countRageClicks"
              replay={replay}
              showDropdownFilters={showDropdownFilters}
              noPadding
            />
          );

        case ReplayColumn.COUNT_RAGE_CLICKS_NO_HEADER:
          return (
            <RageClickCountCell
              key="countRageClicks"
              replay={replay}
              showDropdownFilters={false}
              noPadding
            />
          );

        case ReplayColumn.DURATION:
          return (
            <DurationCell
              key="duration"
              replay={replay}
              showDropdownFilters={showDropdownFilters}
              noPadding
            />
          );

        case ReplayColumn.OS:
          return (
            <OSCell
              key="os"
              replay={replay}
              showDropdownFilters={showDropdownFilters}
              noPadding
            />
          );

        case ReplayColumn.REPLAY:
          return (
            <ReplayCell
              key="session"
              replay={replay}
              eventView={eventView}
              organization={organization}
              referrer={referrer}
              referrer_table="main"
              noPadding
            />
          );

        case ReplayColumn.SLOWEST_TRANSACTION:
          return (
            <TransactionCell
              key="slowestTransaction"
              replay={replay}
              organization={organization}
              noPadding
            />
          );

        case ReplayColumn.MOST_RAGE_CLICKS:
          return (
            <ReplayCell
              key="mostRageClicks"
              replay={replay}
              organization={organization}
              referrer={referrer}
              eventView={eventView}
              referrer_table="rage-table"
              noPadding
            />
          );

        case ReplayColumn.MOST_DEAD_CLICKS:
          return (
            <ReplayCell
              key="mostDeadClicks"
              replay={replay}
              organization={organization}
              referrer={referrer}
              eventView={eventView}
              referrer_table="dead-table"
              noPadding
            />
          );

        case ReplayColumn.MOST_ERRONEOUS_REPLAYS:
          return (
            <ReplayCell
              key="mostErroneousReplays"
              replay={replay}
              organization={organization}
              referrer={referrer}
              eventView={eventView}
              referrer_table="errors-table"
            />
          );

        default:
          return null;
      }
    },
    [organization, showDropdownFilters, eventView, referrer]
  );

  if (fetchError && !isFetching) {
    return (
      <GridEditable
        error={fetchError}
        isLoading={false}
        data={[]}
        columnOrder={columns}
        emptyMessage={emptyMessage}
        columnSortBy={[]}
        stickyHeader
        grid={{
          onResizeColumn: () => {},
          renderHeadCell,
          renderBodyCell,
        }}
        location={location as Location<any>}
      />
    );
  }

  return (
    <GridEditable
      error={fetchError}
      isLoading={isFetching}
      data={replays ?? []}
      columnOrder={columns}
      emptyMessage={emptyMessage}
      columnSortBy={[]}
      stickyHeader
      grid={{
        onResizeColumn: () => {},
        renderHeadCell,
        renderBodyCell,
      }}
      location={location as Location<any>}
    />
  );
}

export default ReplayTable;
