import {useCallback, useMemo, useRef, useState} from 'react';
import type {ListRowProps} from 'react-virtualized';
import {AutoSizer, CellMeasurer, List as ReactVirtualizedList} from 'react-virtualized';

import {Flex} from 'sentry/components/core/layout/flex';
import Placeholder from 'sentry/components/placeholder';
import JumpButtons from 'sentry/components/replays/jumpButtons';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useJumpButtons from 'sentry/components/replays/useJumpButtons';
import {t} from 'sentry/locale';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import BreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/breadcrumbFilters';
import BreadcrumbRow from 'sentry/views/replays/detail/breadcrumbs/breadcrumbRow';
import useBreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/useBreadcrumbFilters';
import useScrollToCurrentItem from 'sentry/views/replays/detail/breadcrumbs/useScrollToCurrentItem';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import useVirtualizedInspector from 'sentry/views/replays/detail/useVirtualizedInspector';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 53,
};

export default function Breadcrumbs() {
  const {currentTime, replay} = useReplayContext();
  const {onClickTimestamp} = useCrumbHandlers();
  const [showSnippetSet, setShowSnippetSet] = useState<Set<number>>(new Set());

  const startTimestampMs = replay?.getStartTimestampMs() ?? 0;
  const frames = replay?.getChapterFrames();

  const [scrollToRow, setScrollToRow] = useState<undefined | number>(undefined);

  const filterProps = useBreadcrumbFilters({frames: frames || []});
  const {expandPathsRef, items, searchTerm, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  const listRef = useRef<ReactVirtualizedList>(null);

  const deps = useMemo(() => [items, searchTerm], [items, searchTerm]);
  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps,
  });
  const {handleDimensionChange: handleInspectorExpanded} = useVirtualizedInspector({
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

  const handleShowSnipppet = useCallback((index: number) => {
    setShowSnippetSet(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
  }, []);

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const item = (items || [])[index]!;

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
          }}
          updateDimensions={updateList}
          onInspectorExpanded={handleInspectorExpanded}
          showSnippet={showSnippetSet.has(index)}
          allowShowSnippet
          onShowSnippet={handleShowSnipppet}
        />
      </CellMeasurer>
    );
  };

  return (
    <Flex direction="column" wrap="nowrap">
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
        {items?.length ? (
          <JumpButtons
            jump={showJumpUpButton ? 'up' : showJumpDownButton ? 'down' : undefined}
            onClick={onClickToJump}
            tableHeaderHeight={0}
          />
        ) : null}
      </TabItemContainer>
    </Flex>
  );
}
