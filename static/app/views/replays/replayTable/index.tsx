import {Fragment, ReactNode, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Alert from 'sentry/components/alert';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GridEditable from 'sentry/components/gridEditable';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelTable from 'sentry/components/panels/panelTable';
import renderSortableHeaderCell from 'sentry/components/replays/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/replays/useQueryBasedSorting';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import HeaderCell, {colToHeader} from 'sentry/views/replays/replayTable/headerCell';
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
  isOldDeadRageCard?: boolean;
  saveLocation?: boolean;
  showDropdownFilters?: boolean;
};

function getTableCell({
  key,
  replay,
  showDropdownFilters,
  organization,
  referrer,
  eventView,
  noPadding = true,
}: {
  eventView: EventView;
  key: string;
  organization: Organization;
  referrer: string;
  replay: ReplayListRecord | ReplayListRecordWithTx;
  noPadding?: boolean;
  showDropdownFilters?: boolean;
}) {
  switch (key) {
    case ReplayColumn.ACTIVITY:
      return (
        <ActivityCell
          key="activity"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
          noPadding={noPadding}
        />
      );

    case ReplayColumn.BROWSER:
      return (
        <BrowserCell
          key="browser"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
          noPadding={noPadding}
        />
      );

    case ReplayColumn.COUNT_DEAD_CLICKS:
      return (
        <DeadClickCountCell
          key="countDeadClicks"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
          noPadding={noPadding}
        />
      );

    case ReplayColumn.COUNT_DEAD_CLICKS_NO_HEADER:
      return (
        <DeadClickCountCell
          key="countDeadClicks"
          replay={replay}
          showDropdownFilters={false}
          noPadding={noPadding}
        />
      );

    case ReplayColumn.COUNT_ERRORS:
      return (
        <ErrorCountCell
          key="countErrors"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
          noPadding={noPadding}
        />
      );

    case ReplayColumn.COUNT_RAGE_CLICKS:
      return (
        <RageClickCountCell
          key="countRageClicks"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
          noPadding={noPadding}
        />
      );

    case ReplayColumn.COUNT_RAGE_CLICKS_NO_HEADER:
      return (
        <RageClickCountCell
          key="countRageClicks"
          replay={replay}
          showDropdownFilters={false}
          noPadding={noPadding}
        />
      );

    case ReplayColumn.DURATION:
      return (
        <DurationCell
          key="duration"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
          noPadding={noPadding}
        />
      );

    case ReplayColumn.OS:
      return (
        <OSCell
          key="os"
          replay={replay}
          showDropdownFilters={showDropdownFilters}
          noPadding={noPadding}
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
          noPadding={noPadding}
        />
      );

    case ReplayColumn.SLOWEST_TRANSACTION:
      return (
        <TransactionCell
          key="slowestTransaction"
          replay={replay}
          organization={organization}
          noPadding={noPadding}
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
          noPadding={noPadding}
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
          noPadding={noPadding}
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
          noPadding={noPadding}
        />
      );

    default:
      return null;
  }
}

function ReplayTable({
  fetchError,
  isFetching,
  replays,
  sort,
  visibleColumns,
  emptyMessage,
  saveLocation,
  gridRows,
  showDropdownFilters,
  isOldDeadRageCard,
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

  const gridCols = visibleColumns.map(col => {
    return {key: col, name: colToHeader[col]};
  });

  // Using handleResizeColumn causes refetching of replay data every time you resize
  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
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
      return getTableCell({
        key: column.key,
        replay,
        showDropdownFilters,
        organization,
        referrer,
        eventView,
      });
    },
    [organization, showDropdownFilters, eventView, referrer]
  );

  // Old replay table code, still used for the old dead rage cards
  const tableHeaders = visibleColumns
    .filter(Boolean)
    .map(column => <HeaderCell key={column} column={column} sort={sort} />);

  return isOldDeadRageCard ? (
    <StyledPanelTable
      headers={tableHeaders}
      isEmpty={replays?.length === 0}
      isLoading={isFetching}
      visibleColumns={visibleColumns}
      disablePadding
      data-test-id="replay-table"
      emptyMessage={emptyMessage}
      gridRows={isFetching ? undefined : gridRows}
      loader={<LoadingIndicator style={{margin: '54px auto'}} />}
    >
      {replays?.map(replay => {
        return (
          <Fragment key={replay.id}>
            {visibleColumns.map(column => {
              return getTableCell({
                key: column,
                replay,
                showDropdownFilters,
                organization,
                referrer,
                eventView,
                noPadding: false, // old card should have padding
              });
            })}
          </Fragment>
        );
      })}
    </StyledPanelTable>
  ) : (
    <GridEditable
      error={fetchError}
      errorMessage={
        <StyledAlert type="error" showIcon>
          {typeof fetchError === 'string'
            ? fetchError
            : t(
                'Sorry, the list of replays could not be loaded. This could be due to invalid search parameters or an internal systems error.'
              )}
        </StyledAlert>
      }
      isLoading={isFetching}
      data-test-id="replay-table"
      data={replays ?? []}
      columnOrder={columns}
      emptyMessage={
        <EmptyStateWarning>
          <p>{emptyMessage ?? t('There are no items to display')}</p>
        </EmptyStateWarning>
      }
      columnSortBy={[]}
      stickyHeader
      grid={{
        onResizeColumn: handleResizeColumn, // will cause refetching of replay data
        renderHeadCell,
        renderBodyCell,
      }}
      location={location as Location<any>}
    />
  );
}

const flexibleColumns = [
  ReplayColumn.REPLAY,
  ReplayColumn.MOST_RAGE_CLICKS,
  ReplayColumn.MOST_DEAD_CLICKS,
  ReplayColumn.MOST_ERRONEOUS_REPLAYS,
];

const StyledPanelTable = styled(PanelTable)<{
  visibleColumns: ReplayColumn[];
  gridRows?: string;
}>`
  ${props =>
    props.visibleColumns.includes(ReplayColumn.MOST_RAGE_CLICKS) ||
    props.visibleColumns.includes(ReplayColumn.MOST_DEAD_CLICKS) ||
    props.visibleColumns.includes(ReplayColumn.MOST_ERRONEOUS_REPLAYS)
      ? `border-bottom-left-radius: 0; border-bottom-right-radius: 0;`
      : ``}
  margin-bottom: 0;
  grid-template-columns: ${p =>
    p.visibleColumns
      .filter(Boolean)
      .map(column =>
        flexibleColumns.includes(column) ? 'minmax(100px, 1fr)' : 'max-content'
      )
      .join(' ')};

  ${props =>
    props.gridRows
      ? `grid-template-rows: ${props.gridRows};`
      : `grid-template-rows: 44px max-content;`}
`;

const StyledAlert = styled(Alert)`
  border-radius: 0;
  border-width: 1px 0 0 0;
  grid-column: 1/-1;
  margin-bottom: 0;
`;

export default ReplayTable;
