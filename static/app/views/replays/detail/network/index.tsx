import {useCallback, useMemo, useRef} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import Placeholder from 'sentry/components/placeholder';
import JumpButtons from 'sentry/components/replays/jumpButtons';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useJumpButtons, {
  type VisibleRange,
} from 'sentry/components/replays/useJumpButtons';
import {GridTable} from 'sentry/components/replays/virtualizedGrid/gridTable';
import {OverflowHidden} from 'sentry/components/replays/virtualizedGrid/overflowHidden';
import {SplitPanel} from 'sentry/components/replays/virtualizedGrid/splitPanel';
import useDetailsSplit from 'sentry/components/replays/virtualizedGrid/useDetailsSplit';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import {getFrameMethod, getFrameStatus} from 'sentry/utils/replays/resourceFrame';
import useOrganization from 'sentry/utils/useOrganization';
import FilterLoadingIndicator from 'sentry/views/replays/detail/filterLoadingIndicator';
import NetworkDetails from 'sentry/views/replays/detail/network/details';
import NetworkFilters from 'sentry/views/replays/detail/network/networkFilters';
import NetworkHeaderCell, {
  COLUMN_COUNT,
} from 'sentry/views/replays/detail/network/networkHeaderCell';
import NetworkTableCell from 'sentry/views/replays/detail/network/networkTableCell';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedGrid from 'sentry/views/replays/detail/useVirtualizedGrid';
import {VirtualTable} from 'sentry/views/replays/detail/virtualizedTableLayout';
import {
  getTimelineRowClassName,
  getVisibleRangeFromVirtualRows,
} from 'sentry/views/replays/detail/virtualizedTableUtils';

const HEADER_HEIGHT = 25;
const BODY_HEIGHT = 25;
const RESIZEABLE_HANDLE_HEIGHT = 90;
const DEFAULT_COLUMN_WIDTH = 88;
const DYNAMIC_COLUMN_INDEX = 2;
const MIN_DYNAMIC_COLUMN_WIDTH = 180;
const OVERSCAN = 20;
const STATIC_COLUMN_WIDTHS = [76, 76, 0, 88, 88, 98, 116];

export default function NetworkList() {
  const organization = useOrganization();
  const replay = useReplayReader();
  const {currentTime} = useReplayContext();
  const [currentHoverTime] = useCurrentHoverTime();
  const {onMouseEnter, onMouseLeave, onClickTimestamp} = useCrumbHandlers();

  const isNetworkDetailsSetup = Boolean(replay?.isNetworkDetailsSetup());
  const isCaptureBodySetup = Boolean(replay?.isNetworkCaptureBodySetup());
  const networkFrames = replay?.getNetworkFrames();
  const projectId = replay?.getReplay()?.project_id;
  const startTimestampMs = replay?.getReplay()?.started_at?.getTime() || 0;

  const filterProps = useNetworkFilters({networkFrames: networkFrames || []});
  const {items: filteredItems, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {handleSort, items, sortConfig} = useSortNetwork({items: filteredItems});

  const containerRef = useRef<HTMLDivElement>(null);
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
      setTimeout(() => {
        virtualizer.scrollToIndex(row - 1, {align: 'auto'});
      }, 50);
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

  const {
    onClickCell,
    onCloseDetailsSplit,
    resizableDrawerProps,
    selectedIndex,
    splitSize,
  } = useDetailsSplit({
    containerRef,
    frames: networkFrames,
    handleHeight: RESIZEABLE_HANDLE_HEIGHT,
    urlParamName: 'n_detail_row',
    onShowDetails: useCallback(
      ({dataIndex, rowIndex}: {dataIndex: number; rowIndex: number}) => {
        handleScrollToTableRow(rowIndex);
        const item = items[dataIndex];
        if (!item) {
          return;
        }
        trackAnalytics('replay.details-network-panel-opened', {
          is_sdk_setup: isNetworkDetailsSetup,
          organization,
          resource_method: getFrameMethod(item),
          resource_status: String(getFrameStatus(item)),
          resource_type: item.op,
        });
      },
      [handleScrollToTableRow, isNetworkDetailsSetup, items, organization]
    ),
    onHideDetails: useCallback(() => {
      trackAnalytics('replay.details-network-panel-closed', {
        is_sdk_setup: isNetworkDetailsSetup,
        organization,
      });
    }, [isNetworkDetailsSetup, organization]),
  });

  const selectedItem =
    selectedIndex === '' ? null : (items[Number(selectedIndex)] ?? null);

  return (
    <Flex direction="column" wrap="nowrap">
      <FilterLoadingIndicator isLoading={!replay}>
        <NetworkFilters networkFrames={networkFrames} {...filterProps} />
      </FilterLoadingIndicator>
      <GridTable ref={containerRef} data-test-id="replay-details-network-tab">
        <SplitPanel
          style={{
            gridTemplateRows: splitSize === undefined ? '1fr' : `1fr auto ${splitSize}px`,
          }}
        >
          {networkFrames ? (
            <OverflowHidden>
              <VirtualTable ref={wrapperRef}>
                <VirtualTable.BodyScrollContainer ref={scrollContainerRef}>
                  <VirtualTable.HeaderViewport style={{width: totalColumnWidth}}>
                    <VirtualTable.HeaderRow
                      style={{
                        gridTemplateColumns,
                      }}
                    >
                      {Array.from({length: COLUMN_COUNT}, (_, columnIndex) => (
                        <NetworkHeaderCell
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
                        unfilteredItems={networkFrames}
                        clearSearchTerm={clearSearchTerm}
                      >
                        {replay?.getReplay()?.sdk.name?.includes('flutter')
                          ? tct(
                              'No network requests recorded. Make sure you are using either the [link1:Sentry Dio] or the [link2:Sentry HTTP] integration.',
                              {
                                link1: (
                                  <ExternalLink href="https://docs.sentry.io/platforms/dart/integrations/dio/" />
                                ),
                                link2: (
                                  <ExternalLink href="https://docs.sentry.io/platforms/dart/integrations/http-integration/" />
                                ),
                              }
                            )
                          : t('No network requests recorded')}
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
                          const network = items[virtualRow.index];
                          if (!network) {
                            return null;
                          }

                          const rowIndex = virtualRow.index + 1;
                          const isByTimestamp = sortConfig.by === 'startTimestamp';
                          const hasOccurred = currentTime >= network.offsetMs;
                          const isBeforeHover =
                            currentHoverTime === undefined ||
                            currentHoverTime >= network.offsetMs;
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
                              useTransparentBorders
                              key={virtualRow.key}
                              className={rowClassName}
                              data-index={virtualRow.index}
                              style={{
                                gridTemplateColumns,
                                height: BODY_HEIGHT,
                              }}
                            >
                              {Array.from({length: COLUMN_COUNT}, (_, columnIndex) => (
                                <NetworkTableCell
                                  key={`${virtualRow.key}-${columnIndex}`}
                                  columnIndex={columnIndex}
                                  frame={network}
                                  onMouseEnter={onMouseEnter}
                                  onMouseLeave={onMouseLeave}
                                  onClickCell={onClickCell}
                                  onClickTimestamp={onClickTimestamp}
                                  rowIndex={rowIndex}
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
              </VirtualTable>
              {sortConfig.by === 'startTimestamp' && items.length ? (
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
          <NetworkDetails
            {...resizableDrawerProps}
            isSetup={isNetworkDetailsSetup}
            isCaptureBodySetup={isCaptureBodySetup}
            item={selectedItem}
            onClose={onCloseDetailsSplit}
            projectId={projectId}
            startTimestampMs={startTimestampMs}
          />
        </SplitPanel>
      </GridTable>
    </Flex>
  );
}
