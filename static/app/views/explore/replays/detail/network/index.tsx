import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import {Container, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {Placeholder} from 'sentry/components/placeholder';
import {JumpButtons} from 'sentry/components/replays/jumpButtons';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useJumpButtons} from 'sentry/components/replays/useJumpButtons';
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
import {FluidHeight} from 'sentry/views/explore/replays/detail/layout/fluidHeight';
import {NetworkDetails} from 'sentry/views/explore/replays/detail/network/details';
import {NetworkFilters} from 'sentry/views/explore/replays/detail/network/networkFilters';
import {
  NETWORK_TABLE_COLUMNS,
  NetworkTableHeader,
} from 'sentry/views/explore/replays/detail/network/networkTableHeader';
import {NetworkTableRow} from 'sentry/views/explore/replays/detail/network/networkTableRow';
import {useNetworkFilters} from 'sentry/views/explore/replays/detail/network/useNetworkFilters';
import {useSortNetwork} from 'sentry/views/explore/replays/detail/network/useSortNetwork';
import {NoRowRenderer} from 'sentry/views/explore/replays/detail/noRowRenderer';
import {useVirtualizedTable} from 'sentry/views/explore/replays/detail/useVirtualizedTable';
import {getTimelineRowClassName} from 'sentry/views/explore/replays/detail/virtualizedTableUtils';

const RESIZEABLE_HANDLE_HEIGHT = 90;

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
  const {paddingBottom, paddingTop, tableRef, virtualRows, virtualizer, visibleRange} =
    useVirtualizedTable({rowCount: items.length});

  const handleScrollToTableRow = useCallback(
    (row: number) => {
      setTimeout(() => {
        virtualizer.scrollToIndex(row - 1, {align: 'auto'});
      }, 50);
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
      <FluidHeight
        ref={containerRef}
        border="primary"
        radius="md"
        data-test-id="replay-details-network-tab"
      >
        <SplitPanel
          style={{
            gridTemplateRows: splitSize === undefined ? '1fr' : `1fr auto ${splitSize}px`,
          }}
        >
          {networkFrames ? (
            <Container position="relative" minHeight="0" minWidth="0">
              <FlushTable
                aria-label={t('Network requests')}
                columns={NETWORK_TABLE_COLUMNS}
                customSections
                maxHeight="100%"
                ref={tableRef}
                scrollable
              >
                <NetworkTableHeader handleSort={handleSort} sortConfig={sortConfig} />
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

                      const isByTimestamp = sortConfig.by === 'startTimestamp';

                      return (
                        <NetworkTableRow
                          key={virtualRow.key}
                          ref={virtualizer.measureElement}
                          className={getTimelineRowClassName({
                            hasHoverTime: currentHoverTime !== undefined,
                            hasOccurred: currentTime >= network.offsetMs,
                            isAsc: isByTimestamp ? sortConfig.asc : false,
                            isBeforeHover:
                              currentHoverTime === undefined ||
                              currentHoverTime >= network.offsetMs,
                            isByTimestamp,
                            isLastDataRow: virtualRow.index === items.length - 1,
                          })}
                          dataIndex={virtualRow.index}
                          frame={network}
                          isSelected={selectedIndex === virtualRow.index}
                          onMouseEnter={onMouseEnter}
                          onMouseLeave={onMouseLeave}
                          onClickRow={onClickCell}
                          onClickTimestamp={onClickTimestamp}
                          startTimestampMs={startTimestampMs}
                        />
                      );
                    })}
                  </SimpleTable.Body>
                )}
              </FlushTable>
              {sortConfig.by === 'startTimestamp' && items.length ? (
                <JumpButtons
                  jump={showJumpUpButton ? 'up' : showJumpDownButton ? 'down' : undefined}
                  onClick={onClickToJump}
                  tableHeaderHeight={SIMPLE_TABLE_HEADER_ROW_HEIGHT}
                />
              ) : null}
            </Container>
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
      </FluidHeight>
    </Stack>
  );
}

const FlushTable = styled(SimpleTable)`
  border: 0;
  border-radius: 0;
`;
