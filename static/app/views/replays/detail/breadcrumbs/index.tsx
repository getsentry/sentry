import {useCallback, useMemo, useRef, useState} from 'react';
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
import BreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/breadcrumbFilters';
import BreadcrumbRow from 'sentry/views/replays/detail/breadcrumbs/breadcrumbRow';
import useBreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/useBreadcrumbFilters';
import useScrollToCurrentItem from 'sentry/views/replays/detail/breadcrumbs/useScrollToCurrentItem';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';

// Estimated row height - matches previous minHeight from cellMeasurer config
const ESTIMATED_ROW_HEIGHT = 50;

export default function Breadcrumbs() {
  const replay = useReplayReader();
  const {currentTime} = useReplayContext();
  const {onClickTimestamp} = useCrumbHandlers();
  const [showSnippetSet, setShowSnippetSet] = useState<Set<number>>(new Set());

  const startTimestampMs = replay?.getStartTimestampMs() ?? 0;
  const frames = replay?.getChapterFrames();

  const filterProps = useBreadcrumbFilters({frames: frames || []});
  const {expandPathsRef, items, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 30,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Derive visible range from virtual items for jump buttons
  // Filter to only items actually visible in the viewport (not overscan items)
  const visibleRange = useMemo<VisibleRange>(() => {
    if (virtualItems.length === 0) {
      return {startIndex: 0, stopIndex: 0};
    }
    const scrollOffset = virtualizer.scrollOffset ?? 0;
    const viewportHeight = virtualizer.scrollRect?.height ?? 0;
    const viewportEnd = scrollOffset + viewportHeight;

    // Find items that are actually within the visible viewport
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

  // Handle inspector expand/collapse by triggering remeasure
  const handleInspectorExpanded = useCallback(
    (index: number, path: string, expandedState: Record<string, boolean>) => {
      const rowState = expandPathsRef.current?.get(index) || new Set<string>();
      if (expandedState[path]) {
        rowState.add(path);
      } else {
        rowState.delete(path);
      }
      expandPathsRef.current?.set(index, rowState);
      // Trigger remeasure for dynamic heights
      virtualizer.measure();
    },
    [expandPathsRef, virtualizer]
  );

  // Callback for jump buttons to scroll directly
  const handleScrollToRow = useCallback(
    (row: number) => {
      virtualizer.scrollToIndex(row, {align: 'center'});
    },
    [virtualizer]
  );

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

  useScrollToCurrentItem({
    frames: items,
    virtualizer: scrollContainerRef.current ? virtualizer : null,
  });

  const handleShowSnipppet = useCallback((index: number) => {
    setShowSnippetSet(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
  }, []);

  // Handler to trigger remeasure when dimensions change (e.g., snippet shown)
  const updateDimensions = useCallback(() => {
    virtualizer.measure();
  }, [virtualizer]);

  return (
    <Flex direction="column" wrap="nowrap">
      <BreadcrumbFilters frames={frames} {...filterProps} />
      <TabItemContainer data-test-id="replay-details-breadcrumbs-tab">
        {frames ? (
          <ScrollContainer ref={scrollContainerRef}>
            {items.length === 0 ? (
              <NoRowRenderer unfilteredItems={frames} clearSearchTerm={clearSearchTerm}>
                {t('No breadcrumbs recorded')}
              </NoRowRenderer>
            ) : (
              <VirtualizedContent style={{height: virtualizer.getTotalSize()}}>
                <VirtualOffset offset={virtualItems[0]?.start ?? 0}>
                  {virtualItems.map(virtualItem => {
                    const item = items[virtualItem.index]!;
                    return (
                      <BreadcrumbRow
                        key={virtualItem.key}
                        ref={virtualizer.measureElement}
                        index={virtualItem.index}
                        frame={item}
                        startTimestampMs={startTimestampMs}
                        expandPaths={Array.from(
                          expandPathsRef.current?.get(virtualItem.index) || []
                        )}
                        onClick={() => {
                          onClickTimestamp(item);
                        }}
                        updateDimensions={updateDimensions}
                        onInspectorExpanded={handleInspectorExpanded}
                        showSnippet={showSnippetSet.has(virtualItem.index)}
                        allowShowSnippet
                        onShowSnippet={handleShowSnipppet}
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
