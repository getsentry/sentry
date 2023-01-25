import {useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  GridCellProps,
  InfiniteLoader,
  MultiGrid,
} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useInfiniteLoader, {
  LoadingStatus,
} from 'sentry/views/replays/detail/useInfiniteLoader';
import useLoadReplaysFromUser from 'sentry/views/replays/detail/userReplays/useLoadReplaysFromUser';
import useVirtualizedGrid from 'sentry/views/replays/detail/useVirtualizedGrid';
import HeaderCell from 'sentry/views/replays/replayTable/headerCell';
import TableCell from 'sentry/views/replays/replayTable/tableCell';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayId: undefined | string;
  user: undefined | ReplayRecord['user'];
};
const HEADER_HEIGHT = 28;
const BODY_HEIGHT = 32;

const COLUMNS = [
  ReplayColumns.dateTime,
  ReplayColumns.duration,
  ReplayColumns.countUrls,
  ReplayColumns.countErrors,
  ReplayColumns.activity,
];

function ReplaysFromUser({replayId, user}: Props) {
  const routes = useRoutes();
  const organization = useOrganization();

  const {eventView, loadRows} = useLoadReplaysFromUser({user});

  const {isRowLoaded, loadMoreRows, rows, rowState} = useInfiniteLoader<ReplayListRecord>(
    {
      loadRows,
      initialStartIndex: 0,
      initialStopIndex: 5,
    }
  );

  const gridRef = useRef<MultiGrid | null>(null);
  const {cache, getColumnWidth, onScrollbarPresenceChange, onWrapperResize} =
    useVirtualizedGrid({
      cellMeasurer: {
        defaultWidth: 100,
        fixedHeight: true,
      },
      gridRef,
      columnCount: COLUMNS.length,
      dynamicColumnIndex: 0,
      deps: [rows],
    });

  const referrer = getRouteStringFromRoutes(routes);

  const cellRenderer = ({columnIndex, rowIndex, key, parent, style}: GridCellProps) => {
    // Adjust index by 1 because the loader doesn't know about the header row
    const dataIndex = rowIndex - 1;

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={columnIndex}
        key={key}
        parent={parent}
        rowIndex={rowIndex}
      >
        {rowIndex === 0 ? (
          <Header style={style}>
            <HeaderCell key={COLUMNS[columnIndex]} column={COLUMNS[columnIndex]} />
          </Header>
        ) : rowState[dataIndex] === LoadingStatus.LOADED ? (
          <Body style={style} isCurrent={rows[dataIndex].id === replayId}>
            <TableCell
              column={COLUMNS[columnIndex]}
              eventView={eventView!}
              organization={organization}
              referrer={referrer}
              replay={rows[dataIndex]}
            />
          </Body>
        ) : null}
      </CellMeasurer>
    );
  };

  return (
    <SessionsContainer>
      <SessionsTable>
        {isRowLoaded({index: 0}) ? (
          <InfiniteLoader
            isRowLoaded={isRowLoaded}
            loadMoreRows={loadMoreRows}
            rowCount={1000}
            minimumBatchSize={5}
          >
            {({onRowsRendered, registerChild}) => {
              return (
                <AutoSizer onResize={onWrapperResize}>
                  {({width, height}) => (
                    <MultiGrid
                      ref={elem => {
                        gridRef.current = elem;
                        registerChild(elem);
                      }}
                      columnCount={COLUMNS.length}
                      columnWidth={getColumnWidth(width)}
                      cellRenderer={cellRenderer}
                      estimatedRowSize={50}
                      // TODO(replays): I think this should be included, but it puts all cells in position `top:0;left:0`
                      // deferredMeasurementCache={cache}
                      fixedRowCount={1}
                      headerHeight={28}
                      height={height}
                      noContentRenderer={() => (
                        <NoRowRenderer
                          unfilteredItems={Object.values(rows) || []}
                          clearSearchTerm={() => {}}
                        >
                          {t('No sessions recorded')}
                        </NoRowRenderer>
                      )}
                      onScrollbarPresenceChange={onScrollbarPresenceChange}
                      onSectionRendered={({rowStartIndex, rowStopIndex}) =>
                        // Adjust indexes by 1 because the loader doesn't know about the header row
                        onRowsRendered({
                          startIndex: rowStartIndex - 1,
                          stopIndex: rowStopIndex - 1,
                        })
                      }
                      overscanColumnCount={COLUMNS.length}
                      overscanRowCount={5}
                      // Adjust count by 1 because the loader doesn't know about the header row
                      rowCount={Object.keys(rows).length + 1}
                      rowHeight={({index}) => (index === 0 ? HEADER_HEIGHT : BODY_HEIGHT)}
                      width={width}
                    />
                  )}
                </AutoSizer>
              );
            }}
          </InfiniteLoader>
        ) : (
          <Placeholder height="100%" />
        )}
      </SessionsTable>
    </SessionsContainer>
  );
}

const SessionsContainer = styled(FluidHeight)`
  height: 100%;
`;

const SessionsTable = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const Header = styled('div')`
  border: 0;
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  line-height: 16px;
  text-align: unset;
  text-transform: uppercase;

  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(0.5)} ${space(1)} ${space(0.5)} ${space(1.5)};

  svg {
    margin-left: ${space(0.25)};
  }
`;

const Body = styled('div')<{isCurrent: boolean}>`
  ${p => p.theme.overflowEllipsis};
  font-variant-numeric: tabular-nums;

  display: flex;
  align-items: center;
  height: 100%;
  gap: ${space(1)};
  padding: ${space(0.5)} ${space(1)};

  background: ${p => (p.isCurrent ? p.theme.hover : 'inherit')};
`;

export default ReplaysFromUser;
