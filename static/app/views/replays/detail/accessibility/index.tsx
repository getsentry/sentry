import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AutoSizer, CellMeasurer, GridCellProps, MultiGrid} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import JumpButtons from 'sentry/components/replays/jumpButtons';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useJumpButtons from 'sentry/components/replays/useJumpButtons';
import {GridTable} from 'sentry/components/replays/virtualizedGrid/gridTable';
import {OverflowHidden} from 'sentry/components/replays/virtualizedGrid/overflowHidden';
import {SplitPanel} from 'sentry/components/replays/virtualizedGrid/splitPanel';
import useDetailsSplit from 'sentry/components/replays/virtualizedGrid/useDetailsSplit';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useA11yData from 'sentry/utils/replays/hooks/useA11yData';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useOrganization from 'sentry/utils/useOrganization';
import AccessibilityFilters from 'sentry/views/replays/detail/accessibility/accessibilityFilters';
import AccessibilityHeaderCell, {
  COLUMN_COUNT,
} from 'sentry/views/replays/detail/accessibility/accessibilityHeaderCell';
import AccessibilityRefetchBanner from 'sentry/views/replays/detail/accessibility/accessibilityRefetchBanner';
import AccessibilityTableCell from 'sentry/views/replays/detail/accessibility/accessibilityTableCell';
import AccessibilityDetails from 'sentry/views/replays/detail/accessibility/details';
import useAccessibilityFilters from 'sentry/views/replays/detail/accessibility/useAccessibilityFilters';
import useSortAccessibility from 'sentry/views/replays/detail/accessibility/useSortAccessibility';
import FilterLoadingIndicator from 'sentry/views/replays/detail/filterLoadingIndicator';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedGrid from 'sentry/views/replays/detail/useVirtualizedGrid';

const HEADER_HEIGHT = 25;
const BODY_HEIGHT = 25;

const RESIZEABLE_HANDLE_HEIGHT = 105;

const cellMeasurer = {
  defaultHeight: BODY_HEIGHT,
  defaultWidth: 100,
  fixedHeight: true,
};

function AccessibilityList() {
  const organization = useOrganization();
  const {currentTime, currentHoverTime} = useReplayContext();
  const {onMouseEnter, onMouseLeave, onClickTimestamp} = useCrumbHandlers();

  const {
    dataOffsetMs,
    data: accessibilityData,
    isLoading,
    isRefetching,
    refetch,
  } = useA11yData();

  const [scrollToRow, setScrollToRow] = useState<undefined | number>(undefined);

  const filterProps = useAccessibilityFilters({
    accessibilityData: accessibilityData || [],
  });
  const {items: filteredItems, searchTerm, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {handleSort, items, sortConfig} = useSortAccessibility({items: filteredItems});

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<MultiGrid>(null);
  const deps = useMemo(() => [items, searchTerm], [items, searchTerm]);
  const {cache, getColumnWidth, onScrollbarPresenceChange, onWrapperResize} =
    useVirtualizedGrid({
      cellMeasurer,
      gridRef,
      columnCount: COLUMN_COUNT,
      dynamicColumnIndex: 2,
      deps,
    });

  const {
    onClickCell,
    onCloseDetailsSplit,
    resizableDrawerProps,
    selectedIndex,
    splitSize,
  } = useDetailsSplit({
    containerRef,
    handleHeight: RESIZEABLE_HANDLE_HEIGHT,
    frames: accessibilityData,
    urlParamName: 'a_detail_row',
    onShowDetails: useCallback(
      ({dataIndex, rowIndex}) => {
        setScrollToRow(rowIndex);

        const item = items[dataIndex];
        trackAnalytics('replay.accessibility-issue-clicked', {
          organization,
          issue_description: item.description,
          issue_impact: item.impact,
        });
      },
      [items, organization]
    ),
  });

  useEffect(() => {
    if (isRefetching) {
      onCloseDetailsSplit();
    }
  }, [isRefetching, onCloseDetailsSplit]);

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
    const a11yIssue = items[rowIndex - 1];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={columnIndex}
        key={key}
        parent={parent}
        rowIndex={rowIndex}
      >
        {({measure: _, registerChild}) =>
          rowIndex === 0 ? (
            <AccessibilityHeaderCell
              ref={e => e && registerChild?.(e)}
              handleSort={handleSort}
              index={columnIndex}
              sortConfig={sortConfig}
              style={{...style, height: HEADER_HEIGHT}}
            />
          ) : (
            <AccessibilityTableCell
              columnIndex={columnIndex}
              currentHoverTime={currentHoverTime}
              currentTime={currentTime}
              a11yIssue={a11yIssue}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onClickCell={onClickCell}
              onClickTimestamp={onClickTimestamp}
              ref={e => e && registerChild?.(e)}
              rowIndex={rowIndex}
              sortConfig={sortConfig}
              style={{...style, height: BODY_HEIGHT}}
            />
          )
        }
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <FilterLoadingIndicator isLoading={isLoading || isRefetching}>
        <AccessibilityFilters accessibilityData={accessibilityData} {...filterProps} />
      </FilterLoadingIndicator>
      <AccessibilityRefetchBanner initialOffsetMs={dataOffsetMs} refetch={refetch} />
      <StyledGridTable ref={containerRef} data-test-id="replay-details-accessibility-tab">
        <SplitPanel
          style={{
            gridTemplateRows: splitSize !== undefined ? `1fr auto ${splitSize}px` : '1fr',
          }}
        >
          {accessibilityData && !isRefetching ? (
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
                        unfilteredItems={accessibilityData}
                        clearSearchTerm={clearSearchTerm}
                      >
                        {t('No accessibility problems detected')}
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
          <AccessibilityDetails
            {...resizableDrawerProps}
            item={selectedIndex ? items[selectedIndex] : null}
            onClose={onCloseDetailsSplit}
          />
        </SplitPanel>
      </StyledGridTable>
    </FluidHeight>
  );
}

const StyledGridTable = styled(GridTable)`
  border-radius: ${p => p.theme.borderRadiusBottom};
  border-top: none;
`;

export default AccessibilityList;
