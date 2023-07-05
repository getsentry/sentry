import {useMemo, useRef} from 'react';
import {AutoSizer, CellMeasurer, GridCellProps, MultiGrid} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ErrorFrame} from 'sentry/utils/replays/types';
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
const BODY_HEIGHT = 28;

type Props = {
  errorFrames: undefined | ErrorFrame[];
  startTimestampMs: number;
};

const cellMeasurer = {
  defaultHeight: BODY_HEIGHT,
  defaultWidth: 100,
  fixedHeight: true,
};

function ErrorList({errorFrames, startTimestampMs}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const filterProps = useErrorFilters({errorFrames: errorFrames || []});
  const {items: filteredItems, searchTerm, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {handleSort, items, sortConfig} = useSortErrors({items: filteredItems});

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

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
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClickTimestamp={handleClick}
              ref={e => e && registerChild?.(e)}
              rowIndex={rowIndex}
              sortConfig={sortConfig}
              frame={error}
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
      <ErrorTable>
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
                  overscanColumnCount={COLUMN_COUNT}
                  overscanRowCount={5}
                  rowCount={items.length + 1}
                  rowHeight={({index}) => (index === 0 ? HEADER_HEIGHT : BODY_HEIGHT)}
                  width={width}
                />
              )}
            </AutoSizer>
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
