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
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
// import PerfFilters from 'sentry/views/replays/detail/perfTable/perfFilters';
import PerfRow from 'sentry/views/replays/detail/perfTable/perfRow';
// import usePerfFilters from 'sentry/views/replays/detail/perfTable/usePerfFilters';
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

export default function PerfTable({perfData}: Props) {
  const {currentTime, currentHoverTime, replay} = useReplayContext();
  const startTimestampMs = replay?.getReplay().started_at.getTime() ?? 0;

  const traceRows = perfData.data;

  // const filterProps = usePerfFilters({traceRows: traceRows || []});
  // const {items, setSearchTerm} = filterProps;
  const items = perfData.data;
  const clearSearchTerm = () => {}; //  setSearchTerm('');

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
      {/* <PerfFilters traceRows={traceRows} {...filterProps} /> */}
      <TabItemContainer>
        {traceRows ? (
          <AutoSizer onResize={updateList}>
            {({width, height}) => (
              <ReactVirtualizedList
                deferredMeasurementCache={cache}
                height={height}
                noRowsRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={traceRows}
                    clearSearchTerm={clearSearchTerm}
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
