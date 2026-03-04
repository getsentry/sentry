import {useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Flex} from '@sentry/scraps/layout';

import Placeholder from 'sentry/components/placeholder';
import JumpButtons from 'sentry/components/replays/jumpButtons';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useJumpButtons, {
  type VisibleRange,
} from 'sentry/components/replays/useJumpButtons';
import {t} from 'sentry/locale';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import type {BreadcrumbFrame} from 'sentry/utils/replays/types';
import ConsoleFilters from 'sentry/views/replays/detail/console/consoleFilters';
import ConsoleLogRow from 'sentry/views/replays/detail/console/consoleLogRow';
import useConsoleFilters from 'sentry/views/replays/detail/console/useConsoleFilters';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import useVirtualizedInspector from 'sentry/views/replays/detail/useVirtualizedInspector';

// Slightly above the old minHeight to reduce "compressed then expand" feel.
const ESTIMATED_ROW_HEIGHT = 32;

function getVirtualItemKey(item: BreadcrumbFrame | undefined, index: number) {
  if (!item) {
    return index;
  }

  // Avoid heavy key generation from full message payloads.
  return `${item.timestampMs}-${item.offsetMs}-${index}`;
}

export default function Console() {
  const replay = useReplayReader();
  const {currentTime} = useReplayContext();
  const [currentHoverTime] = useCurrentHoverTime();
  const {onMouseEnter, onMouseLeave, onClickTimestamp} = useCrumbHandlers();

  const startTimestampMs = replay?.getReplay()?.started_at?.getTime() ?? 0;
  const frames = replay?.getConsoleFrames();

  const filterProps = useConsoleFilters({frames: frames || []});
  const {expandPathsRef, items, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 12,
    getItemKey: index => getVirtualItemKey(items[index], index),
    useAnimationFrameWithResizeObserver: true,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Derive visible range from virtual items for jump buttons,
  // filtering out overscan items that are outside the viewport.
  const visibleRange = useMemo<VisibleRange>(() => {
    if (virtualItems.length === 0) {
      return {startIndex: 0, stopIndex: 0};
    }
    const scrollOffset = virtualizer.scrollOffset ?? 0;
    const viewportHeight = virtualizer.scrollRect?.height ?? 0;
    const viewportEnd = scrollOffset + viewportHeight;

    const visibleItems = virtualItems.filter(item => {
      const itemEnd = item.start + item.size;
      return itemEnd > scrollOffset && item.start < viewportEnd;
    });

    if (visibleItems.length === 0) {
      return {startIndex: 0, stopIndex: 0};
    }

    return {
      startIndex: visibleItems[0]!.index,
      stopIndex: visibleItems[visibleItems.length - 1]!.index,
    };
  }, [virtualItems, virtualizer.scrollOffset, virtualizer.scrollRect?.height]);

  const handleScrollToRow = useCallback(
    (row: number) => {
      virtualizer.scrollToIndex(row, {align: 'center'});
    },
    [virtualizer]
  );

  const handleMeasure = useCallback(
    (index: number) => {
      window.requestAnimationFrame(() => {
        const row = scrollContainerRef.current?.querySelector<HTMLElement>(
          `[data-index="${index}"]`
        );

        if (row) {
          virtualizer.measureElement(row);
          return;
        }

        virtualizer.measure();
      });
    },
    [virtualizer]
  );

  const {handleDimensionChange} = useVirtualizedInspector({
    expandPathsRef,
    onMeasure: handleMeasure,
  });

  const {
    handleClick: onClickToJump,
    showJumpDownButton,
    showJumpUpButton,
  } = useJumpButtons({
    currentTime,
    frames: items,
    isTable: false,
    setScrollToRow: handleScrollToRow,
    visibleRange,
  });

  return (
    <Flex direction="column" wrap="nowrap">
      <ConsoleFilters frames={frames} {...filterProps} />
      <TabItemContainer data-test-id="replay-details-console-tab">
        {frames ? (
          <ScrollContainer ref={scrollContainerRef}>
            {items.length === 0 ? (
              <NoRowRenderer unfilteredItems={frames} clearSearchTerm={clearSearchTerm}>
                {t('No console logs recorded')}
              </NoRowRenderer>
            ) : (
              <VirtualizedContent style={{height: virtualizer.getTotalSize()}}>
                <VirtualOffset offset={virtualItems[0]?.start ?? 0}>
                  {virtualItems.map(virtualItem => {
                    const item = items[virtualItem.index]!;
                    return (
                      <ConsoleLogRow
                        key={virtualItem.key}
                        ref={virtualizer.measureElement}
                        dataIndex={virtualItem.index}
                        currentHoverTime={currentHoverTime}
                        currentTime={currentTime}
                        expandPaths={Array.from(
                          expandPathsRef.current?.get(virtualItem.index) || []
                        )}
                        frame={item}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        index={virtualItem.index}
                        onClickTimestamp={onClickTimestamp}
                        onDimensionChange={handleDimensionChange}
                        startTimestampMs={startTimestampMs}
                      />
                    );
                  })}
                </VirtualOffset>
              </VirtualizedContent>
            )}
          </ScrollContainer>
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

const ScrollContainer = styled('div')`
  position: absolute;
  inset: 0;
  overflow: auto;
  overscroll-behavior: contain;
`;

const VirtualizedContent = styled('div')`
  position: relative;
  width: 100%;
`;

const VirtualOffset = styled('div')<{offset: number}>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  transform: translateY(${p => p.offset}px);
`;
