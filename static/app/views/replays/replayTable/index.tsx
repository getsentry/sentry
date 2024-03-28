import type {ReactNode} from 'react';
import {memo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import useUrlParams from 'sentry/utils/useUrlParams';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import HeaderCell from 'sentry/views/replays/replayTable/headerCell';
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

type Props = {
  fetchError: undefined | Error;
  isFetching: boolean;
  replays: undefined | ReplayListRecord[] | ReplayListRecordWithTx[];
  sort: Sort | undefined;
  visibleColumns: ReplayColumn[];
  emptyMessage?: ReactNode;
  gridRows?: string;
  onClickPlay?: (index: number) => void;
  referrerLocation?: string;
  showDropdownFilters?: boolean;
};

// Memoizing this component to avoid unnecessary re-renders
const ReplayTable = memo(
  ({
    fetchError,
    isFetching,
    replays,
    sort,
    visibleColumns,
    emptyMessage,
    gridRows,
    showDropdownFilters,
    onClickPlay,
    referrerLocation,
  }: Props) => {
    const routes = useRoutes();
    const location = useLocation();
    const organization = useOrganization();

    // we may have a selected replay index in the URLs
    const urlParams = useUrlParams();
    const rawReplayIndex = urlParams.getParamValue('selected_replay_index');
    const selectedReplayIndex = parseInt(
      typeof rawReplayIndex === 'string' ? rawReplayIndex : '0',
      10
    );

    const tableHeaders = visibleColumns
      .filter(Boolean)
      .map(column => <HeaderCell key={column} column={column} sort={sort} />);

    if (fetchError && !isFetching) {
      return (
        <StyledPanelTable
          headers={tableHeaders}
          isLoading={false}
          visibleColumns={visibleColumns}
          data-test-id="replay-table"
          gridRows={undefined}
        >
          <StyledAlert type="error" showIcon>
            {typeof fetchError === 'string'
              ? fetchError
              : t(
                  'Sorry, the list of replays could not be loaded. This could be due to invalid search parameters or an internal systems error.'
                )}
          </StyledAlert>
        </StyledPanelTable>
      );
    }

    const referrer = getRouteStringFromRoutes(routes);
    const eventView = EventView.fromLocation(location);

    return (
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
        {replays?.map(
          (replay: ReplayListRecord | ReplayListRecordWithTx, index: number) => {
            return (
              <Row
                key={replay.id}
                isPlaying={index === selectedReplayIndex && referrerLocation !== 'replay'}
                onClick={() => onClickPlay?.(index)}
                showCursor={onClickPlay !== undefined}
              >
                {visibleColumns.map(column => {
                  switch (column) {
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
                        <OSCell
                          key="os"
                          replay={replay}
                          showDropdownFilters={showDropdownFilters}
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
                        />
                      );

                    case ReplayColumn.PLAY_PAUSE:
                      return (
                        <PlayPauseCell
                          key="play"
                          isSelected={selectedReplayIndex === index}
                          handleClick={() => onClickPlay?.(index)}
                        />
                      );

                    case ReplayColumn.SLOWEST_TRANSACTION:
                      return (
                        <TransactionCell
                          key="slowestTransaction"
                          replay={replay}
                          organization={organization}
                        />
                      );

                    default:
                      return null;
                  }
                })}
              </Row>
            );
          }
        )}
      </StyledPanelTable>
    );
  }
);

const StyledPanelTable = styled(PanelTable)<{
  visibleColumns: ReplayColumn[];
  gridRows?: string;
}>`
  margin-bottom: 0;
  grid-template-columns: ${p =>
    p.visibleColumns
      .filter(Boolean)
      .map(column => (column === 'replay' ? 'minmax(100px, 1fr)' : 'max-content'))
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

const Row = styled('div')<{isPlaying?: boolean; showCursor?: boolean}>`
  display: contents;
  & > * {
    background-color: ${p => (p.isPlaying ? p.theme.translucentInnerBorder : 'inherit')};
    border-bottom: 1px solid ${p => p.theme.border};
    cursor: ${p => (p.showCursor ? 'pointer' : 'default')};
  }
  :hover {
    background-color: ${p => (p.showCursor ? p.theme.translucentInnerBorder : 'inherit')};
  }
`;

export default ReplayTable;
