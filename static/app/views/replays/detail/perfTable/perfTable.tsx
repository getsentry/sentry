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
import FilterLoadingIndicator from 'sentry/views/replays/detail/filterLoadingIndicator';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import PerfFilters from 'sentry/views/replays/detail/perfTable/perfFilters';
import PerfRow from 'sentry/views/replays/detail/perfTable/perfRow';
import usePerfFilters from 'sentry/views/replays/detail/perfTable/usePerfFilters';
import type useReplayPerfData from 'sentry/views/replays/detail/perfTable/useReplayPerfData';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';
import useVirtualListDimentionChange from 'sentry/views/replays/detail/useVirtualListDimentionChange';

interface Props {
  perfData: ReturnType<typeof useReplayPerfData>;
}

const cellMeasurer = {
  fixedWidth: true,
  minHeight: 24,
};

export default function PerfTable({perfData}: Props) {
  const {currentTime, currentHoverTime, replay} = useReplayContext();
  const startTimestampMs = replay?.getReplay().started_at.getTime() ?? 0;

  const traceRows = Array.from(perfData.data.values());

  const filterProps = usePerfFilters({traceRows: traceRows || []});
  const {items} = filterProps; // setSearchTerm
  const clearSearchTerm = () => {}; //  setSearchTerm('');

  const listRef = useRef<ReactVirtualizedList>(null);
  const deps = useMemo(() => [items], [items]);
  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps,
  });

  const {handleDimensionChange} = useVirtualListDimentionChange({cache, listRef});

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
          index={index}
          onDimensionChange={handleDimensionChange}
          startTimestampMs={startTimestampMs}
          style={style}
          traceRow={traceRow}
        />
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <FilterLoadingIndicator isLoading={perfData.isFetching}>
        <PerfFilters traceRows={traceRows} {...filterProps} />
      </FilterLoadingIndicator>
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
