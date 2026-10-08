import {useCallback} from 'react';

import {Container, Stack} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import {JumpButtons} from 'sentry/components/replays/jumpButtons';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useJumpButtons} from 'sentry/components/replays/useJumpButtons';
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
  ERROR_TABLE_COLUMNS,
  ErrorTableHeader,
} from 'sentry/views/explore/replays/detail/errorList/errorTableHeader';
import {ErrorTableRow} from 'sentry/views/explore/replays/detail/errorList/errorTableRow';
import {useErrorFilters} from 'sentry/views/explore/replays/detail/errorList/useErrorFilters';
import {useSortErrors} from 'sentry/views/explore/replays/detail/errorList/useSortErrors';
import {NoRowRenderer} from 'sentry/views/explore/replays/detail/noRowRenderer';
import {useVirtualizedTable} from 'sentry/views/explore/replays/detail/useVirtualizedTable';
import {getTimelineRowClassName} from 'sentry/views/explore/replays/detail/virtualizedTableUtils';

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

  const {paddingBottom, paddingTop, tableRef, virtualRows, virtualizer, visibleRange} =
    useVirtualizedTable({rowCount: items.length});

  const handleScrollToTableRow = useCallback(
    (row: number) => {
      virtualizer.scrollToIndex(row - 1, {align: 'center', behavior: 'smooth'});
    },
    [virtualizer]
  );

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
      <Container
        flexGrow={1}
        minHeight="0"
        position="relative"
        data-test-id="replay-details-errors-tab"
      >
        {errorFrames ? (
          <SimpleTable
            aria-label={t('Errors')}
            columns={ERROR_TABLE_COLUMNS}
            customSections
            density="compressed"
            maxHeight="100%"
            ref={tableRef}
            scrollable
          >
            <ErrorTableHeader handleSort={handleSort} sortConfig={sortConfig} />
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

                  return (
                    <ErrorTableRow
                      key={virtualRow.key}
                      ref={virtualizer.measureElement}
                      className={getTimelineRowClassName({
                        hasHoverTime: currentHoverTime !== undefined,
                        hasOccurred: currentTime >= error.offsetMs,
                        isAsc: isByTimestamp ? sortConfig.asc : false,
                        isBeforeHover:
                          currentHoverTime === undefined ||
                          currentHoverTime >= error.offsetMs,
                        isByTimestamp,
                        isLastDataRow: virtualRow.index === items.length - 1,
                      })}
                      dataIndex={virtualRow.index}
                      frame={error}
                      onMouseEnter={onMouseEnter}
                      onMouseLeave={onMouseLeave}
                      onClickTimestamp={onClickTimestamp}
                      startTimestampMs={startTimestampMs}
                    />
                  );
                })}
              </SimpleTable.Body>
            )}
          </SimpleTable>
        ) : (
          <Placeholder height="100%" />
        )}
        {errorFrames && sortConfig.by === 'timestamp' && items.length ? (
          <JumpButtons
            jump={showJumpUpButton ? 'up' : showJumpDownButton ? 'down' : undefined}
            onClick={onClickToJump}
            tableHeaderHeight={SIMPLE_TABLE_HEADER_ROW_HEIGHT}
          />
        ) : null}
      </Container>
    </Stack>
  );
}
