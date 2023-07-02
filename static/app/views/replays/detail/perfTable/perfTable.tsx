import {useMemo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
// import {useLocation} from 'sentry/utils/useLocation';
// import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import PerfRow from 'sentry/views/replays/detail/perfTable/perfRow';
import type {ReplayTraceRow} from 'sentry/views/replays/detail/perfTable/useReplayPerfData';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

interface Props {
  perfData: {
    data: ReplayTraceRow[];
    eventView: EventView | null;
  };
}

const cellMeasurer = {
  fixedWidth: true,
  minHeight: 24,
};

// function getMaxVisibleDuration(rows: ReplayTraceRow[]) {
//   return rows.reduce((max, row) => {
//     return Math.max(max, ...row.traces.map(trace => trace['transaction.duration']));
//   }, 0);
// }

export default function PerfTable({perfData}: Props) {
  const {currentTime, currentHoverTime, replay} = useReplayContext();
  const startTimestampMs = replay?.getReplay().started_at.getTime() ?? 0;

  const items = perfData.data;

  const listRef = useRef<ReactVirtualizedList>(null);
  const deps = useMemo(() => [items], [items]);
  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps,
  });

  // const maxVisibleDuration = getMaxVisibleDuration(items);

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const traceRow = items[index];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <PerfRow
          currentHoverTime={currentHoverTime}
          currentTime={currentTime}
          eventView={perfData.eventView}
          // onDimensionChange={handleDimensionChange}
          startTimestampMs={startTimestampMs}
          style={style}
          traceRow={traceRow}
        />
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      {/* <DomFilters actions={actions} {...filterProps} /> */}
      <TabItemContainer>
        {perfData.data ? (
          <AutoSizer onResize={updateList}>
            {({width, height}) => (
              <ReactVirtualizedList
                deferredMeasurementCache={cache}
                height={height}
                noRowsRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={perfData.data}
                    clearSearchTerm={() => {}}
                  >
                    {t('No events recorded')}
                  </NoRowRenderer>
                )}
                overscanRowCount={5}
                ref={listRef}
                rowCount={items.length}
                rowHeight={cache.rowHeight}
                rowRenderer={renderRow}
                width={width}
              />
            )}
          </AutoSizer>
        ) : (
          <Placeholder height="100%" />
        )}
      </TabItemContainer>
    </FluidHeight>
  );
}
