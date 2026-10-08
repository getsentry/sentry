import {useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {Placeholder} from 'sentry/components/placeholder';
import {JumpButtons} from 'sentry/components/replays/jumpButtons';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {
  useJumpButtons,
  type VisibleRange,
} from 'sentry/components/replays/useJumpButtons';
import {GridTable} from 'sentry/components/replays/virtualizedGrid/gridTable';
import {OverflowHidden} from 'sentry/components/replays/virtualizedGrid/overflowHidden';
import {SplitPanel} from 'sentry/components/replays/virtualizedGrid/splitPanel';
import {useDetailsSplit} from 'sentry/components/replays/virtualizedGrid/useDetailsSplit';
import {
  SIMPLE_TABLE_HEADER_ROW_HEIGHT,
  SimpleTable,
} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCrumbHandlers} from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {useCurrentHoverTime} from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import {getFrameMethod, getFrameStatus} from 'sentry/utils/replays/resourceFrame';
import {useOrganization} from 'sentry/utils/useOrganization';
import {FilterLoadingIndicator} from 'sentry/views/explore/replays/detail/filterLoadingIndicator';
import {NetworkDetails} from 'sentry/views/explore/replays/detail/network/details';
import {NetworkFilters} from 'sentry/views/explore/replays/detail/network/networkFilters';
import {
  COLUMN_COUNT,
  NetworkHeaderCell,
  TABLE_COLUMNS,
} from 'sentry/views/explore/replays/detail/network/networkHeaderCell';
import {NetworkTableCell} from 'sentry/views/explore/replays/detail/network/networkTableCell';
import {useNetworkFilters} from 'sentry/views/explore/replays/detail/network/useNetworkFilters';
import {useSortNetwork} from 'sentry/views/explore/replays/detail/network/useSortNetwork';
import {NoRowRenderer} from 'sentry/views/explore/replays/detail/noRowRenderer';
import {useVirtualizedGrid} from 'sentry/views/explore/replays/detail/useVirtualizedGrid';
import {VirtualTable} from 'sentry/views/explore/replays/detail/virtualizedTableLayout';
import {
  getTimelineRowClassName,
  getVisibleRangeFromVirtualRows,
} from 'sentry/views/explore/replays/detail/virtualizedTableUtils';

const HEADER_HEIGHT = SIMPLE_TABLE_HEADER_ROW_HEIGHT.compressed;
const BODY_HEIGHT = 25;
const RESIZEABLE_HANDLE_HEIGHT = 90;
const OVERSCAN = 20;

export function NetworkList() {
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
  const {paddingBottom, paddingTop, scrollContainerRef, virtualRows, virtualizer} =
    useVirtualizedGrid({
      overscan: OVERSCAN,
      rowCount: items.length,
      rowHeight: BODY_HEIGHT,
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

  const selectedItem = selectedIndex === null ? null : (items[selectedIndex] ?? null);

  return (
    <Stack minHeight="0" minWidth="0" wrap="nowrap">
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
              <FlushTable
                aria-label={t('Network requests')}
                columns={TABLE_COLUMNS}
                customSections
                density="compressed"
                maxHeight="100%"
                ref={scrollContainerRef}
                scrollable
              >
                <SimpleTable.Head sticky>
                  <SimpleTable.HeaderRow>
                    {Array.from({length: COLUMN_COUNT}, (_, columnIndex) => (
                      <NetworkHeaderCell
                        key={columnIndex}
                        handleSort={handleSort}
                        index={columnIndex}
                        sortConfig={sortConfig}
                        style={{height: HEADER_HEIGHT}}
                      />
                    ))}
                  </SimpleTable.HeaderRow>
                </SimpleTable.Head>
                {items.length === 0 ? (
                  <SimpleTable.Body>
                    <SimpleTable.Empty>
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
                    </SimpleTable.Empty>
                  </SimpleTable.Body>
                ) : (
                  <SimpleTable.Body style={{paddingBottom, paddingTop}}>
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
                            height: BODY_HEIGHT,
                          }}
                        >
                          {Array.from({length: COLUMN_COUNT}, (_, columnIndex) => (
                            <NetworkTableCell
                              key={`${virtualRow.key}-${columnIndex}`}
                              columnIndex={columnIndex}
                              frame={network}
                              isSelected={selectedIndex === virtualRow.index}
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
                  </SimpleTable.Body>
                )}
              </FlushTable>
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
    </Stack>
  );
}

const FlushTable = styled(SimpleTable)`
  border: 0;
  border-radius: 0;
`;
