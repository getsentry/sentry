import {useCallback, useMemo, useRef, useState} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  GridCellProps,
  InfiniteLoader,
  MultiGrid,
} from 'react-virtualized';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'sentry/api';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import fetchReplayList, {
  DEFAULT_SORT,
  REPLAY_LIST_FIELDS,
} from 'sentry/utils/replays/fetchReplayList';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedGrid from 'sentry/views/replays/detail/useVirtualizedGrid';
import HeaderCell from 'sentry/views/replays/replayTable/headerCell';
import TableCell from 'sentry/views/replays/replayTable/tableCell';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  user: undefined | ReplayRecord['user'];
};

function getUserCondition(user: undefined | ReplayRecord['user']) {
  if (user?.id) {
    return `user.id:${user.id}`;
  }
  if (user?.email) {
    return `user.email:${user.email}`;
  }
  if (user?.ip_address) {
    return `user.ip_address:${user.ip_address}`;
  }
  return '';
}

function ReplaysFromUser({user}: Props) {
  const eventView = useMemo(() => {
    const query = getUserCondition(user);
    if (!query) {
      return null;
    }
    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      projects: [],
      query,
      orderby: DEFAULT_SORT,
    });
  }, [user]);

  if (eventView) {
    return <SessionsList eventView={eventView} />;
  }
  return <Placeholder height="100%" />;
}

const COLUMNS = [
  ReplayColumns.user,
  ReplayColumns.startedAt,
  ReplayColumns.duration,
  ReplayColumns.countErrors,
  ReplayColumns.activity,
];

enum Status {
  loading,
  loaded,
}

type Opts = {
  api: Client;
  eventView: EventView;
  organization: Organization;
};

function useReplayInifiniteLoader({api, eventView, organization}: Opts) {
  const loadedRowsRef = useRef(new Map<number, Status>());
  const [replays, setReplays] = useState<ReplayListRecord[]>();

  const isRowLoaded = useCallback(({index}) => {
    return loadedRowsRef.current.has(index);
  }, []);

  const loadMoreRows = useCallback(
    async ({startIndex, stopIndex}) => {
      // console.log('load more rows', {startIndex, stopIndex});

      for (let i = startIndex; i <= stopIndex; i++) {
        loadedRowsRef.current.set(i, Status.loading);
      }

      const {
        fetchError,
        // pageLinks,
        replays: newReplays,
      } = await fetchReplayList({
        api,
        eventView,
        location: {
          query: {
            per_page: String(stopIndex - startIndex),
            cursor: `0:${startIndex}:0`,
          },
        } as Location<{
          cursor: string;
          per_page: string;
        }>,
        organization,
      });

      // console.log('resp', {fetchError, newReplays});
      if (!fetchError) {
        // console.log('loaded!', {pageLinks});

        for (let i = startIndex; i <= stopIndex; i++) {
          loadedRowsRef.current.set(i, Status.loaded);
        }
        setReplays(prev => [...(prev || []), ...(newReplays || [])]);
      }
    },
    [api, eventView, organization]
  );

  return {
    replays,
    isRowLoaded,
    loadMoreRows,
  };
}

function SessionsList({eventView}: {eventView: EventView}) {
  const api = useApi();
  const routes = useRoutes();
  const organization = useOrganization();

  const {replays, isRowLoaded, loadMoreRows} = useReplayInifiniteLoader({
    api,
    eventView,
    organization,
  });

  const gridRef = useRef<MultiGrid>(null);
  // const wrapperRef = useRef<HTMLDivElement>(null);
  const {cache, getColumnWidth, onScrollbarPresenceChange, onWrapperResize} =
    useVirtualizedGrid({
      cellMeasurer: {
        defaultWidth: 100,
        fixedHeight: true,
      },
      gridRef,
      // wrapperRef,
      columnCount: COLUMNS.length,
      dyanmicColumnIndex: 0,
      deps: [],
    });

  const referrer = getRouteStringFromRoutes(routes);

  const renderCell = ({columnIndex, rowIndex, key, parent, style}: GridCellProps) => {
    // const rowRenderer = ({columnIndex, index, key, parent, style}) => {
    // if (index === 0) {
    //   console.log('render title row');
    //   return (
    //     <div key={key} style={style}>
    //       {new Array(6).fill(0).map((_, i) => (
    //         <Header key={i}>
    //           <HeaderCell key={COLUMNS[i]} column={COLUMNS[i]} />
    //         </Header>
    //       ))}
    //     </div>
    //   );
    // }
    // const dataIndex = index - 1;
    // if (!isRowLoaded({index: dataIndex})) {
    //   return (
    //     <div key={key} style={style}>
    //       <Placeholder height="24px" />
    //     </div>
    //   );
    // }
    // // const replay = replays![dataIndex];
    // return (
    //   <div key={key} style={style}>
    //     data row ${dataIndex}
    //   </div>
    // );

    if (rowIndex === 0) {
      return (
        <CellMeasurer
          cache={cache}
          columnIndex={columnIndex}
          key={key}
          parent={parent}
          rowIndex={rowIndex}
        >
          <Header style={style}>
            <HeaderCell key={COLUMNS[columnIndex]} column={COLUMNS[columnIndex]} />
          </Header>
        </CellMeasurer>
      );
    }

    if (!replays) {
      return (
        <CellMeasurer
          cache={cache}
          columnIndex={columnIndex}
          key={key}
          parent={parent}
          rowIndex={rowIndex}
        >
          <Body style={style}>
            <Placeholder height="32px" />
          </Body>
        </CellMeasurer>
      );
    }

    const replay = replays[rowIndex - 1];

    if (!replay) {
      return (
        <CellMeasurer
          cache={cache}
          columnIndex={columnIndex}
          key={key}
          parent={parent}
          rowIndex={rowIndex}
        >
          <Body style={style}>
            <Placeholder height="32px" />
          </Body>
        </CellMeasurer>
      );
    }

    // console.log('rendering', {rowIndex, replay, replays});
    return (
      <CellMeasurer
        cache={cache}
        columnIndex={columnIndex}
        key={key}
        parent={parent}
        rowIndex={rowIndex}
      >
        <Body style={style}>
          <TableCell
            column={COLUMNS[columnIndex]}
            eventView={eventView}
            organization={organization}
            referrer={referrer}
            replay={replay}
          />
        </Body>
      </CellMeasurer>
    );
  };

  return (
    <SessionsContainer>
      <SessionsTable>
        {!replays ? (
          <Placeholder height="100%" />
        ) : (
          <InfiniteLoader
            isRowLoaded={isRowLoaded}
            loadMoreRows={loadMoreRows}
            rowCount={10000}
            minimumBatchSize={50}
          >
            {({onRowsRendered, registerChild}) => {
              console.log('loader rendered');
              return (
                <AutoSizer onResize={onWrapperResize}>
                  {({width, height}) => (
                    <MultiGrid
                      ref={registerChild}
                      columnCount={COLUMNS.length}
                      columnWidth={getColumnWidth(width)}
                      cellRenderer={renderCell}
                      deferredMeasurementCache={cache}
                      fixedRowCount={1}
                      height={height}
                      noContentRenderer={() => (
                        <NoRowRenderer
                          unfilteredItems={replays}
                          clearSearchTerm={() => {}}
                        >
                          {t('No sessions found')}
                        </NoRowRenderer>
                      )}
                      onSectionRendered={({rowStartIndex, rowStopIndex}) => {
                        onRowsRendered({
                          startIndex: rowStartIndex,
                          stopIndex: rowStopIndex,
                        });
                      }}
                      onScrollbarPresenceChange={onScrollbarPresenceChange}
                      overscanColumnCount={COLUMNS.length}
                      overscanRowCount={5}
                      rowCount={replays.length + 1}
                      rowHeight={({index}) => (index === 0 ? 25 : 50)}
                      width={width}
                    />
                  )}
                </AutoSizer>
              );
            }}
          </InfiniteLoader>
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

const Body = styled('div')`
  padding: ${space(0.5)} ${space(1)};
`;

export default ReplaysFromUser;
