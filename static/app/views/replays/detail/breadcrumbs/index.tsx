import {memo, useMemo, useRef} from 'react';
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
import type {Crumb} from 'sentry/types/breadcrumbs';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import BreadcrumbRow from 'sentry/views/replays/detail/breadcrumbs/breadcrumbRow';
import useScrollToCurrentItem from 'sentry/views/replays/detail/breadcrumbs/useScrollToCurrentItem';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

import useVirtualizedInspector from '../useVirtualizedInspector';

type Props = {
  breadcrumbs: undefined | Crumb[];
  startTimestampMs: number;
};

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 53,
};

function Breadcrumbs({breadcrumbs, startTimestampMs}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const listRef = useRef<ReactVirtualizedList>(null);
  // Keep a reference of object paths that are expanded (via <ObjectInspector>)
  // by log row, so they they can be restored as the Console pane is scrolling.
  // Due to virtualization, components can be unmounted as the user scrolls, so
  // state needs to be remembered.
  //
  // Note that this is intentionally not in state because we do not want to
  // re-render when items are expanded/collapsed, though it may work in state as well.
  const expandPathsRef = useRef(new Map<number, Set<string>>());

  const itemLookup = useMemo(
    () =>
      breadcrumbs &&
      breadcrumbs
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
    [breadcrumbs]
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

  const deps = useMemo(() => [breadcrumbs], [breadcrumbs]);
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

  useScrollToCurrentItem({
    breadcrumbs,
    ref: listRef,
    startTimestampMs,
  });

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const item = (breadcrumbs || [])[index];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <BreadcrumbRow
          index={index}
          isCurrent={current?.id === item.id}
          isHovered={hovered?.id === item.id}
          breadcrumb={item}
          startTimestampMs={startTimestampMs}
          style={style}
          expandPaths={Array.from(expandPathsRef.current?.get(index) || [])}
          onDimensionChange={handleDimensionChange}
        />
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <BreadcrumbContainer>
        {breadcrumbs ? (
          <AutoSizer onResize={updateList}>
            {({height, width}) => (
              <ReactVirtualizedList
                deferredMeasurementCache={cache}
                height={height}
                noRowsRenderer={() => (
                  <NoRowRenderer unfilteredItems={breadcrumbs} clearSearchTerm={() => {}}>
                    {t('No breadcrumbs recorded')}
                  </NoRowRenderer>
                )}
                overscanRowCount={5}
                ref={listRef}
                rowCount={breadcrumbs.length}
                rowHeight={cache.rowHeight}
                rowRenderer={renderRow}
                width={width}
              />
            )}
          </AutoSizer>
        ) : (
          <Placeholder height="100%" />
        )}
      </BreadcrumbContainer>
    </FluidHeight>
  );
}

const BreadcrumbContainer = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default memo(Breadcrumbs);
