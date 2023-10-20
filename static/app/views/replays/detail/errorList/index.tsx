import {useMemo, useRef, useState} from 'react';
import {AutoSizer, CellMeasurer, GridCellProps, MultiGrid} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import JumpButtons from 'sentry/components/replays/jumpButtons';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useJumpButtons from 'sentry/components/replays/useJumpButtons';
import {t} from 'sentry/locale';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import ErrorFilters from 'sentry/views/replays/detail/errorList/errorFilters';
import ErrorHeaderCell, {
  COLUMN_COUNT,
} from 'sentry/views/replays/detail/errorList/errorHeaderCell';
import ErrorTableCell from 'sentry/views/replays/detail/errorList/errorTableCell';
import useErrorFilters from 'sentry/views/replays/detail/errorList/useErrorFilters';
import useSortErrors from 'sentry/views/replays/detail/errorList/useSortErrors';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedGrid from 'sentry/views/replays/detail/useVirtualizedGrid';

const HEADER_HEIGHT = 25;
const BODY_HEIGHT = 25;

const cellMeasurer = {
  defaultHeight: BODY_HEIGHT,
  defaultWidth: 100,
  fixedHeight: true,
};

function ErrorList() {
  const {currentTime, currentHoverTime, replay} = useReplayContext();
  const {onMouseEnter, onMouseLeave, onClickTimestamp} = useCrumbHandlers();

  const errorFrames = replay?.getErrorFrames();
  const startTimestampMs = replay?.getReplay().started_at.getTime() ?? 0;

  const [scrollToRow, setScrollToRow] = useState<undefined | number>(undefined);

  const filterProps = useErrorFilters({errorFrames: errorFrames || []});
  const {items: filteredItems, searchTerm, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {handleSort, items, sortConfig} = useSortErrors({items: filteredItems});

  const gridRef = useRef<MultiGrid>(null);
  const deps = useMemo(() => [items, searchTerm], [items, searchTerm]);
  const {cache, getColumnWidth, onScrollbarPresenceChange, onWrapperResize} =
    useVirtualizedGrid({
      cellMeasurer,
      gridRef,
      columnCount: COLUMN_COUNT,
      dynamicColumnIndex: 1,
      deps,
    });

  const {
    handleClick: onClickToJump,
    onSectionRendered,
    showJumpDownButton,
    showJumpUpButton,
  } = useJumpButtons({
    currentTime,
    frames: filteredItems,
    isTable: true,
    setScrollToRow,
  });

  const cellRenderer = ({columnIndex, rowIndex, key, style, parent}: GridCellProps) => {
    const error = items[rowIndex - 1];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={columnIndex}
        key={key}
        parent={parent}
        rowIndex={rowIndex}
      >
        {({
          measure: _,
          registerChild,
        }: {
          measure: () => void;
          registerChild?: (element?: Element) => void;
        }) =>
          rowIndex === 0 ? (
            <ErrorHeaderCell
              ref={e => e && registerChild?.(e)}
              handleSort={handleSort}
              index={columnIndex}
              sortConfig={sortConfig}
              style={{...style, height: HEADER_HEIGHT}}
            />
          ) : (
            <ErrorTableCell
              columnIndex={columnIndex}
              currentHoverTime={currentHoverTime}
              currentTime={currentTime}
              frame={error}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onClickTimestamp={onClickTimestamp}
              ref={e => e && registerChild?.(e)}
              rowIndex={rowIndex}
              sortConfig={sortConfig}
              startTimestampMs={startTimestampMs}
              style={{...style, height: BODY_HEIGHT}}
            />
          )
        }
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <ErrorFilters errorFrames={errorFrames} {...filterProps} />
      <ErrorTable data-test-id="replay-details-errors-tab">
        {errorFrames ? (
          <OverflowHidden>
            <AutoSizer onResize={onWrapperResize}>
              {({height, width}) => (
                <MultiGrid
                  ref={gridRef}
                  cellRenderer={cellRenderer}
                  columnCount={COLUMN_COUNT}
                  columnWidth={getColumnWidth(width)}
                  deferredMeasurementCache={cache}
                  estimatedColumnSize={100}
                  estimatedRowSize={BODY_HEIGHT}
                  fixedRowCount={1}
                  height={height}
                  noContentRenderer={() => (
                    <NoRowRenderer
                      unfilteredItems={errorFrames}
                      clearSearchTerm={clearSearchTerm}
                    >
                      {t('No errors! Go make some.')}
                    </NoRowRenderer>
                  )}
                  onScrollbarPresenceChange={onScrollbarPresenceChange}
                  onScroll={() => {
                    if (scrollToRow !== undefined) {
                      setScrollToRow(undefined);
                    }
                  }}
                  onSectionRendered={onSectionRendered}
                  overscanColumnCount={COLUMN_COUNT}
                  overscanRowCount={5}
                  rowCount={items.length + 1}
                  rowHeight={({index}) => (index === 0 ? HEADER_HEIGHT : BODY_HEIGHT)}
                  scrollToRow={scrollToRow}
                  width={width}
                />
              )}
            </AutoSizer>
            {sortConfig.by === 'timestamp' && items.length ? (
              <JumpButtons
                jump={showJumpUpButton ? 'up' : showJumpDownButton ? 'down' : undefined}
                onClick={onClickToJump}
                tableHeaderHeight={HEADER_HEIGHT}
              />
            ) : null}
          </OverflowHidden>
        ) : (
          <Placeholder height="100%" />
        )}
      </ErrorTable>
    </FluidHeight>
  );
}

const OverflowHidden = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  display: grid;
`;

const ErrorTable = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};

  .beforeHoverTime + .afterHoverTime:before {
    border-top: 1px solid ${p => p.theme.purple200};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 999999999%;
  }

  .beforeHoverTime:last-child:before {
    border-bottom: 1px solid ${p => p.theme.purple200};
    content: '';
    right: 0;
    position: absolute;
    bottom: 0;
    width: 999999999%;
  }

  .beforeCurrentTime + .afterCurrentTime:before {
    border-top: 1px solid ${p => p.theme.purple300};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 999999999%;
  }

  .beforeCurrentTime:last-child:before {
    border-bottom: 1px solid ${p => p.theme.purple300};
    content: '';
    right: 0;
    position: absolute;
    bottom: 0;
    width: 999999999%;
  }
`;

export default ErrorList;
