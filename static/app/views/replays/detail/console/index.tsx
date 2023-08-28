import {memo, useMemo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {BreadcrumbFrame} from 'sentry/utils/replays/types';
import ConsoleFilters from 'sentry/views/replays/detail/console/consoleFilters';
import ConsoleLogRow from 'sentry/views/replays/detail/console/consoleLogRow';
import useConsoleFilters from 'sentry/views/replays/detail/console/useConsoleFilters';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

import useVirtualizedInspector from '../useVirtualizedInspector';

interface Props {
  frames: undefined | BreadcrumbFrame[];
  startTimestampMs: number;
}

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 24,
};

function Console({frames, startTimestampMs}: Props) {
  const {onMouseEnter, onMouseLeave, onClickTimestamp} = useCrumbHandlers();

  const filterProps = useConsoleFilters({frames: frames || []});
  const {expandPathsRef, searchTerm, logLevel, items, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {currentTime, currentHoverTime} = useReplayContext();

  const listRef = useRef<ReactVirtualizedList>(null);

  const deps = useMemo(() => [items], [items]);
  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps,
  });

  const {handleDimensionChange} = useVirtualizedInspector({
    cache,
    listRef,
    expandPathsRef,
  });

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const item = items[index];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        // Set key based on filters, otherwise we can have odd expand/collapse state
        // with <ObjectInspector> when filtering
        key={`${searchTerm}-${logLevel.join(',')}-${key}`}
        parent={parent}
        rowIndex={index}
      >
        <ConsoleLogRow
          currentHoverTime={currentHoverTime}
          currentTime={currentTime}
          expandPaths={Array.from(expandPathsRef.current?.get(index) || [])}
          frame={item}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          index={index}
          onClickTimestamp={onClickTimestamp}
          onDimensionChange={handleDimensionChange}
          startTimestampMs={startTimestampMs}
          style={style}
        />
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <ConsoleFilters frames={frames} {...filterProps} />
      <TabItemContainer data-test-id="replay-details-console-tab">
        {frames ? (
          <AutoSizer onResize={updateList}>
            {({width, height}) => (
              <ReactVirtualizedList
                deferredMeasurementCache={cache}
                height={height}
                noRowsRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={frames}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No console logs recorded')}
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

export default memo(Console);
