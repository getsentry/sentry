import {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import ConsoleFilters from 'sentry/views/replays/detail/console/consoleFilters';
import ConsoleLogRow from 'sentry/views/replays/detail/console/consoleLogRow';
import useConsoleFilters from 'sentry/views/replays/detail/console/useConsoleFilters';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

interface Props {
  breadcrumbs: undefined | Extract<Crumb, BreadcrumbTypeDefault>[];
  startTimestampMs: number;
}

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 24,
};

function Console({breadcrumbs, startTimestampMs}: Props) {
  const filterProps = useConsoleFilters({breadcrumbs: breadcrumbs || []});
  const {searchTerm, logLevel, items, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {currentTime, currentHoverTime} = useReplayContext();
  // Keep a reference of object paths that are expanded (via <ObjectInspector>)
  // by log row, so they they can be restored as the Console pane is scrolling.
  // Due to virtualization, components can be unmounted as the user scrolls, so
  // state needs to be remembered.
  const expandPaths = useRef(new Map<number, Set<string>>());

  const listRef = useRef<ReactVirtualizedList>(null);
  const itemLookup = useMemo(
    () =>
      breadcrumbs &&
      breadcrumbs
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
    [breadcrumbs]
  );

  const deps = useMemo(() => [items], [items]);
  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps,
  });

  // Need to reset `expandPaths` if items changes (e.g. when filtering)
  useEffect(() => {
    expandPaths.current = new Map();
  }, [cache, items]);

  const handleDimensionChange = useCallback(
    (index: number, path: string, expandedState: Record<string, boolean>) => {
      const rowState = expandPaths.current.get(index) || new Set();
      if (expandedState[path]) {
        rowState.add(path);
      } else {
        // Collapsed, i.e. its default state, so no need to store state
        rowState.delete(path);
      }
      expandPaths.current.set(index, rowState);
      cache.clear(index, 0);
      listRef.current?.recomputeGridSize({rowIndex: index});
      listRef.current?.forceUpdateGrid();
    },
    [cache, expandPaths, listRef]
  );

  const current = useMemo(
    () =>
      breadcrumbs
        ? getPrevReplayEvent({
            itemLookup,
            items: breadcrumbs,
            targetTimestampMs: startTimestampMs + currentTime,
          })
        : undefined,
    [itemLookup, breadcrumbs, currentTime, startTimestampMs]
  );

  const hovered = useMemo(
    () =>
      currentHoverTime && breadcrumbs
        ? getPrevReplayEvent({
            itemLookup,
            items: breadcrumbs,
            targetTimestampMs: startTimestampMs + currentHoverTime,
          })
        : undefined,
    [itemLookup, breadcrumbs, currentHoverTime, startTimestampMs]
  );

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
          isCurrent={current?.id === item.id}
          isHovered={hovered?.id === item.id}
          breadcrumb={item}
          index={index}
          startTimestampMs={startTimestampMs}
          style={style}
          expandPaths={Array.from(expandPaths.current.get(index) || [])}
          onDimensionChange={handleDimensionChange}
        />
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <ConsoleFilters breadcrumbs={breadcrumbs} {...filterProps} />
      <ConsoleLogContainer>
        {breadcrumbs ? (
          <AutoSizer onResize={updateList}>
            {({width, height}) => (
              <ReactVirtualizedList
                deferredMeasurementCache={cache}
                height={height}
                noRowsRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={breadcrumbs}
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
      </ConsoleLogContainer>
    </FluidHeight>
  );
}

const ConsoleLogContainer = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default memo(Console);
