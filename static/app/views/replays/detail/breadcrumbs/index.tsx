import {useMemo, useRef, useState} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';

import Placeholder from 'sentry/components/placeholder';
import JumpButtons from 'sentry/components/replays/jumpButtons';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useJumpButtons from 'sentry/components/replays/useJumpButtons';
import {t} from 'sentry/locale';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import BreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/breadcrumbFilters';
import BreadcrumbRow from 'sentry/views/replays/detail/breadcrumbs/breadcrumbRow';
import useBreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/useBreadcrumbFilters';
import useScrollToCurrentItem from 'sentry/views/replays/detail/breadcrumbs/useScrollToCurrentItem';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

import useVirtualizedInspector from '../useVirtualizedInspector';

type Props = {
  frames: undefined | ReplayFrame[];
  startTimestampMs: number;
};

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 53,
};

function Breadcrumbs({frames, startTimestampMs}: Props) {
  const {currentTime} = useReplayContext();
  const {onClickTimestamp} = useCrumbHandlers();

  const {setActiveTab} = useActiveReplayTab();

  const listRef = useRef<ReactVirtualizedList>(null);
  // Keep a reference of object paths that are expanded (via <ObjectInspector>)
  // by log row, so they they can be restored as the Console pane is scrolling.
  // Due to virtualization, components can be unmounted as the user scrolls, so
  // state needs to be remembered.
  //
  // Note that this is intentionally not in state because we do not want to
  // re-render when items are expanded/collapsed, though it may work in state as well.
  const expandPathsRef = useRef(new Map<number, Set<string>>());

  const [scrollToRow, setScrollToRow] = useState<undefined | number>(undefined);

  const filterProps = useBreadcrumbFilters({frames: frames || []});
  const {items, searchTerm, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  const deps = useMemo(() => [items, searchTerm], [items, searchTerm]);
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

  const {
    handleClick: onClickToJump,
    onRowsRendered,
    showJumpDownButton,
    showJumpUpButton,
  } = useJumpButtons({
    currentTime,
    frames: items,
    isTable: false,
    setScrollToRow,
  });

  useScrollToCurrentItem({
    frames,
    ref: listRef,
  });

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const item = (items || [])[index];

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
          frame={item}
          startTimestampMs={startTimestampMs}
          style={style}
          expandPaths={Array.from(expandPathsRef.current?.get(index) || [])}
          onClick={() => {
            onClickTimestamp(item);
            setActiveTab(getFrameDetails(item).tabKey);
          }}
          onDimensionChange={handleDimensionChange}
        />
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <BreadcrumbFilters frames={frames} {...filterProps} />
      <TabItemContainer data-test-id="replay-details-breadcrumbs-tab">
        {frames ? (
          <AutoSizer onResize={updateList}>
            {({height, width}) => (
              <ReactVirtualizedList
                deferredMeasurementCache={cache}
                height={height}
                noRowsRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={frames}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No breadcrumbs recorded')}
                  </NoRowRenderer>
                )}
                onRowsRendered={onRowsRendered}
                onScroll={() => {
                  if (scrollToRow !== undefined) {
                    setScrollToRow(undefined);
                  }
                }}
                overscanRowCount={5}
                ref={listRef}
                rowCount={items.length}
                rowHeight={cache.rowHeight}
                rowRenderer={renderRow}
                scrollToIndex={scrollToRow}
                width={width}
              />
            )}
          </AutoSizer>
        ) : (
          <Placeholder height="100%" />
        )}
        {frames?.length ? (
          <JumpButtons
            jump={showJumpUpButton ? 'up' : showJumpDownButton ? 'down' : undefined}
            onClick={onClickToJump}
            tableHeaderHeight={0}
          />
        ) : null}
      </TabItemContainer>
    </FluidHeight>
  );
}

export default Breadcrumbs;
