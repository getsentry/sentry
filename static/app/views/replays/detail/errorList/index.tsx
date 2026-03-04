import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

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
import ErrorFilters from 'sentry/views/replays/detail/errorList/errorFilters';
import ErrorHeaderCell, {
  COLUMN_COUNT,
} from 'sentry/views/replays/detail/errorList/errorHeaderCell';
import ErrorTableCell from 'sentry/views/replays/detail/errorList/errorTableCell';
import useErrorFilters from 'sentry/views/replays/detail/errorList/useErrorFilters';
import useSortErrors from 'sentry/views/replays/detail/errorList/useSortErrors';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedGrid from 'sentry/views/replays/detail/useVirtualizedGrid';
import {VirtualTable} from 'sentry/views/replays/detail/virtualizedTableLayout';
import {
  getTimelineRowClassName,
  getVisibleRangeFromVirtualRows,
} from 'sentry/views/replays/detail/virtualizedTableUtils';

const HEADER_HEIGHT = 25;
const BODY_HEIGHT = 25;
const DEFAULT_COLUMN_WIDTH = 100;
const DYNAMIC_COLUMN_INDEX = 1;
const MIN_DYNAMIC_COLUMN_WIDTH = 200;
const OVERSCAN = 20;
const STATIC_COLUMN_WIDTHS = [100, 0, 140, 96, 116];

export default function ErrorList() {
  const replay = useReplayReader();
  const {currentTime} = useReplayContext();
  const [currentHoverTime] = useCurrentHoverTime();
  const {onMouseEnter, onMouseLeave, onClickTimestamp} = useCrumbHandlers();

  const errorFrames = replay?.getErrorFrames();
  const startTimestampMs = replay?.getReplay().started_at.getTime() ?? 0;

  const filterProps = useErrorFilters({errorFrames: errorFrames || []});
  const {items: filteredItems, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {handleSort, items, sortConfig} = useSortErrors({items: filteredItems});

  const {
    gridTemplateColumns,
    scrollContainerRef,
    totalColumnWidth,
    virtualRows,
    virtualizer,
    wrapperRef,
  } = useVirtualizedGrid({
    defaultColumnWidth: DEFAULT_COLUMN_WIDTH,
    dynamicColumnIndex: DYNAMIC_COLUMN_INDEX,
    minDynamicColumnWidth: MIN_DYNAMIC_COLUMN_WIDTH,
    overscan: OVERSCAN,
    rowCount: items.length,
    rowHeight: BODY_HEIGHT,
    staticColumnWidths: STATIC_COLUMN_WIDTHS,
  });

  const handleScrollToTableRow = useCallback(
    (row: number) => {
      virtualizer.scrollToIndex(row - 1, {align: 'center', behavior: 'smooth'});
    },
    [virtualizer]
  );

  const visibleRange = useMemo<VisibleRange>(() => {
    return getVisibleRangeFromVirtualRows({
      indexOffset: 1,
      scrollOffset: virtualizer.scrollOffset ?? 0,
      viewportHeight: virtualizer.scrollRect?.height ?? 0,
      virtualRows,
    });
  }, [virtualRows, virtualizer.scrollOffset, virtualizer.scrollRect?.height]);

  const {
    handleClick: onClickToJump,
    showJumpDownButton,
    showJumpUpButton,
  } = useJumpButtons({
    currentTime,
    frames: filteredItems,
    isTable: true,
    setScrollToRow: handleScrollToTableRow,
    visibleRange,
  });

  return (
    <Flex direction="column" wrap="nowrap">
      <ErrorFilters errorFrames={errorFrames} {...filterProps} />
      <ErrorTable data-test-id="replay-details-errors-tab">
        {errorFrames ? (
          <VirtualTable ref={wrapperRef}>
            <VirtualTable.BodyScrollContainer ref={scrollContainerRef}>
              <VirtualTable.HeaderViewport style={{width: totalColumnWidth}}>
                <VirtualTable.HeaderRow
                  style={{
                    gridTemplateColumns,
                  }}
                >
                  {Array.from({length: COLUMN_COUNT}, (_, columnIndex) => (
                    <ErrorHeaderCell
                      key={columnIndex}
                      handleSort={handleSort}
                      index={columnIndex}
                      sortConfig={sortConfig}
                      style={{height: HEADER_HEIGHT}}
                    />
                  ))}
                </VirtualTable.HeaderRow>
              </VirtualTable.HeaderViewport>
              {items.length === 0 ? (
                <VirtualTable.NoRowsContainer>
                  <NoRowRenderer
                    unfilteredItems={errorFrames}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No errors! Go make some.')}
                  </NoRowRenderer>
                </VirtualTable.NoRowsContainer>
              ) : (
                <VirtualTable.Content
                  style={{
                    height: virtualizer.getTotalSize(),
                    width: totalColumnWidth,
                  }}
                >
                  <VirtualTable.Offset
                    offset={virtualRows[0]?.start ?? 0}
                    style={{width: totalColumnWidth}}
                  >
                    {virtualRows.map(virtualRow => {
                      const error = items[virtualRow.index];
                      if (!error) {
                        return null;
                      }

                      const isByTimestamp = sortConfig.by === 'timestamp';
                      const hasOccurred = currentTime >= error.offsetMs;
                      const isBeforeHover =
                        currentHoverTime === undefined ||
                        currentHoverTime >= error.offsetMs;
                      const isAsc = isByTimestamp ? sortConfig.asc : false;

                      const rowClassName = getTimelineRowClassName({
                        hasHoverTime: currentHoverTime !== undefined,
                        hasOccurred,
                        isAsc,
                        isBeforeHover,
                        isByTimestamp,
                        isLastDataRow: virtualRow.index === items.length - 1,
                      });

                      return (
                        <VirtualTable.BodyRow
                          key={virtualRow.key}
                          className={rowClassName}
                          data-index={virtualRow.index}
                          style={{
                            gridTemplateColumns,
                            height: BODY_HEIGHT,
                          }}
                        >
                          {Array.from({length: COLUMN_COUNT}, (_, columnIndex) => (
                            <ErrorTableCell
                              key={`${virtualRow.key}-${columnIndex}`}
                              columnIndex={columnIndex}
                              frame={error}
                              onMouseEnter={onMouseEnter}
                              onMouseLeave={onMouseLeave}
                              onClickTimestamp={onClickTimestamp}
                              startTimestampMs={startTimestampMs}
                              style={{height: BODY_HEIGHT}}
                            />
                          ))}
                        </VirtualTable.BodyRow>
                      );
                    })}
                  </VirtualTable.Offset>
                </VirtualTable.Content>
              )}
            </VirtualTable.BodyScrollContainer>
            {sortConfig.by === 'timestamp' && items.length ? (
              <JumpButtons
                jump={showJumpUpButton ? 'up' : showJumpDownButton ? 'down' : undefined}
                onClick={onClickToJump}
                tableHeaderHeight={HEADER_HEIGHT}
              />
            ) : null}
          </VirtualTable>
        ) : (
          <Placeholder height="100%" />
        )}
      </ErrorTable>
    </Flex>
  );
}

const ErrorTable = styled('div')`
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  flex-grow: 1;
  overflow: hidden;
  height: 100%;

  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;
