<<<<<<< HEAD
import {memo, useCallback, useMemo, useRef} from 'react';
=======
import {memo, useRef} from 'react';
>>>>>>> 4fafd0b0c6 (save reference to expanded paths)
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
  const {items, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {currentTime, currentHoverTime} = useReplayContext();
  // Keep a reference of object paths that are expanded (via <ObjectInspector>)
  // by log row, so they they can be restored as the Console pane is scrolling.
  // Due to virtualization, components can be unmounted as the user scrolls, so
  // state needs to be remembered.
  const expandPaths = useRef(new Map<number, Set<string>>());
  const lastUpdatedRow = useRef<number | null>(null);

  const listRef = useRef<ReactVirtualizedList>(null);
  const itemLookup = useMemo(
    () =>
      breadcrumbs &&
      breadcrumbs
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
    [breadcrumbs]
  );

  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps: [items],
  });

  const handleDimensionChange = (
    index: number,
    path: string,
    expandedState: Record<string, boolean>
  ) => {
    const rowState = expandPaths.current.get(index) || new Set();
    if (expandedState[path]) {
      rowState.add(path);
    } else {
      // Collapsed, i.e. its default state, so no need to store state
      rowState.delete(path);
    }
    expandPaths.current.set(index, rowState);
    updateList();
  };

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
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <ConsoleLogRow
          isCurrent={current?.id === item.id}
          isHovered={hovered?.id === item.id}
          breadcrumb={item}
          startTimestampMs={startTimestampMs}
          style={style}
          expandPaths={Array.from(expandPaths.current.get(index) || [])}
          onDimensionChange={(path, expandedState) =>
            handleDimensionChange(index, path, expandedState)
          }
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
                onRowsRendered={({
                  startIndex,
                  stopIndex,
                }) => {
                  // Can't rely cell measurer cache for large lists as rows
                  // will be evicted. Thus we need to call `updateList` when an
                  // expanded row is rendered in order to get the correct
                  // height.
                  const expandedRow = Array.from(expandPaths.current.keys()).find(
                    i => i > startIndex && i < stopIndex
                  );

                  if (
                    expandedRow !== undefined &&
                    expandedRow !== lastUpdatedRow.current
                  ) {
                    lastUpdatedRow.current = expandedRow;
                    console.log(
                      'need update list',
                      expandedRow,
                      lastUpdatedRow.current,
                      // overscanStartIndex,
                      // overscanStopIndex,
                      startIndex,
                      stopIndex
                    );
                    updateList();
                  }

                  if (
                    lastUpdatedRow.current !== null &&
                    (lastUpdatedRow.current > stopIndex ||
                      lastUpdatedRow.current < startIndex)
                  ) {
                    lastUpdatedRow.current = null;
                  }
                }}
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
