import {useCallback, useMemo} from 'react';

import {Stack} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import {JumpButtons} from 'sentry/components/replays/jumpButtons';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {
  useJumpButtons,
  type VisibleRange,
} from 'sentry/components/replays/useJumpButtons';
import {GridTable} from 'sentry/components/replays/virtualizedGrid/gridTable';
import {OverflowHidden} from 'sentry/components/replays/virtualizedGrid/overflowHidden';
import {
  SIMPLE_TABLE_HEADER_ROW_HEIGHT,
  SimpleTable,
} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {useCrumbHandlers} from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {useCurrentHoverTime} from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import {ErrorFilters} from 'sentry/views/explore/replays/detail/errorList/errorFilters';
import {
  ErrorHeaderCell,
  TABLE_COLUMNS,
} from 'sentry/views/explore/replays/detail/errorList/errorHeaderCell';
import {ErrorTableCell} from 'sentry/views/explore/replays/detail/errorList/errorTableCell';
import {useErrorFilters} from 'sentry/views/explore/replays/detail/errorList/useErrorFilters';
import {useSortErrors} from 'sentry/views/explore/replays/detail/errorList/useSortErrors';
import {NoRowRenderer} from 'sentry/views/explore/replays/detail/noRowRenderer';
import {useVirtualizedGrid} from 'sentry/views/explore/replays/detail/useVirtualizedGrid';
import {VirtualTable} from 'sentry/views/explore/replays/detail/virtualizedTableLayout';
import {
  getTimelineRowClassName,
  getVisibleRangeFromVirtualRows,
} from 'sentry/views/explore/replays/detail/virtualizedTableUtils';

const BODY_HEIGHT = 25;
const OVERSCAN = 20;

export function ErrorList() {
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

  const {paddingBottom, paddingTop, scrollContainerRef, virtualRows, virtualizer} =
    useVirtualizedGrid({
      overscan: OVERSCAN,
      rowCount: items.length,
      rowHeight: BODY_HEIGHT,
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
    <Stack minHeight="0" minWidth="0" wrap="nowrap">
      <ErrorFilters errorFrames={errorFrames} {...filterProps} />
      <GridTable data-test-id="replay-details-errors-tab">
        {errorFrames ? (
          <OverflowHidden>
            <VirtualTable.Table
              aria-label={t('Errors')}
              columns={TABLE_COLUMNS}
              customSections
              density="compressed"
              maxHeight="100%"
              ref={scrollContainerRef}
              scrollable
            >
              <SimpleTable.Head sticky>
                <SimpleTable.HeaderRow>
                  {TABLE_COLUMNS.map((_, columnIndex) => (
                    <ErrorHeaderCell
                      key={columnIndex}
                      handleSort={handleSort}
                      index={columnIndex}
                      sortConfig={sortConfig}
                    />
                  ))}
                </SimpleTable.HeaderRow>
              </SimpleTable.Head>
              {items.length === 0 ? (
                <SimpleTable.Body>
                  <SimpleTable.Empty>
                    <NoRowRenderer
                      unfilteredItems={errorFrames}
                      clearSearchTerm={clearSearchTerm}
                    >
                      {t('No errors! Go make some.')}
                    </NoRowRenderer>
                  </SimpleTable.Empty>
                </SimpleTable.Body>
              ) : (
                <SimpleTable.Body style={{paddingBottom, paddingTop}}>
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
                      >
                        {TABLE_COLUMNS.map((_, columnIndex) => (
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
                </SimpleTable.Body>
              )}
            </VirtualTable.Table>
            {sortConfig.by === 'timestamp' && items.length ? (
              <JumpButtons
                jump={showJumpUpButton ? 'up' : showJumpDownButton ? 'down' : undefined}
                onClick={onClickToJump}
                tableHeaderHeight={SIMPLE_TABLE_HEADER_ROW_HEIGHT.compressed}
              />
            ) : null}
          </OverflowHidden>
        ) : (
          <Placeholder height="100%" />
        )}
      </GridTable>
    </Stack>
  );
}
