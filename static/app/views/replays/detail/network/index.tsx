import {useCallback, useMemo, useRef, useState} from 'react';
import {AutoSizer, CellMeasurer, GridCellProps, MultiGrid} from 'react-virtualized';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconClose, IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import useUrlParams from 'sentry/utils/useUrlParams';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NetworkDetails from 'sentry/views/replays/detail/network/details/networkDetails';
import NetworkFilters from 'sentry/views/replays/detail/network/networkFilters';
import NetworkHeaderCell, {
  COLUMN_COUNT,
} from 'sentry/views/replays/detail/network/networkHeaderCell';
import NetworkTableCell from 'sentry/views/replays/detail/network/networkTableCell';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedGrid from 'sentry/views/replays/detail/useVirtualizedGrid';
import type {NetworkSpan} from 'sentry/views/replays/types';

const HEADER_HEIGHT = 25;
const BODY_HEIGHT = 28;

const RESIZEABLE_HANDLE_HEIGHT = 90;

type Props = {
  isNetworkDetailsSetup: boolean;
  networkSpans: undefined | NetworkSpan[];
  projectId: undefined | string;
  startTimestampMs: number;
};

const cellMeasurer = {
  defaultHeight: BODY_HEIGHT,
  defaultWidth: 100,
  fixedHeight: true,
};

function NetworkList({
  isNetworkDetailsSetup,
  networkSpans,
  projectId,
  startTimestampMs,
}: Props) {
  const organization = useOrganization();
  const {currentTime, currentHoverTime} = useReplayContext();

  const [scrollToRow, setScrollToRow] = useState<undefined | number>(undefined);
  const {dismiss, isDismissed} = useDismissAlert({key: 'replay-network-bodies'});

  const filterProps = useNetworkFilters({networkSpans: networkSpans || []});
  const {items: filteredItems, searchTerm, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {handleSort, items, sortConfig} = useSortNetwork({items: filteredItems});

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const containerRef = useRef<HTMLDivElement>(null);
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

  // `initialSize` cannot depend on containerRef because the ref starts as
  // `undefined` which then gets set into the hook and doesn't update.
  const initialSize = Math.max(150, window.innerHeight * 0.4);

  const {size: containerSize, ...resizableDrawerProps} = useResizableDrawer({
    direction: 'up',
    initialSize,
    min: 0,
    onResize: () => {},
  });
  const {getParamValue: getDetailRow, setParamValue: setDetailRow} = useUrlParams(
    'n_detail_row',
    ''
  );
  const detailDataIndex = getDetailRow();
  const detailRowIndex = Number(detailDataIndex) + 1;

  const maxContainerHeight =
    (containerRef.current?.clientHeight || window.innerHeight) - RESIZEABLE_HANDLE_HEIGHT;
  const splitSize =
    networkSpans && detailDataIndex
      ? Math.min(maxContainerHeight, containerSize)
      : undefined;

  const onClickCell = useCallback(
    ({dataIndex, rowIndex}: {dataIndex: number; rowIndex: number}) => {
      setDetailRow(String(dataIndex));
      setScrollToRow(rowIndex);
    },
    [setDetailRow]
  );

  const cellRenderer = ({columnIndex, rowIndex, key, style, parent}: GridCellProps) => {
    const network = items[rowIndex - 1];

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
            <NetworkHeaderCell
              ref={e => e && registerChild?.(e)}
              handleSort={handleSort}
              index={columnIndex}
              sortConfig={sortConfig}
              style={{...style, height: HEADER_HEIGHT}}
            />
          ) : (
            <NetworkTableCell
              columnIndex={columnIndex}
              currentHoverTime={currentHoverTime}
              currentTime={currentTime}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              onClickTimestamp={handleClick}
              onClickCell={onClickCell}
              ref={e => e && registerChild?.(e)}
              rowIndex={rowIndex}
              sortConfig={sortConfig}
              span={network}
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
      <NetworkFilters networkSpans={networkSpans} {...filterProps} />
      <Feature
        features={['session-replay-network-details']}
        organization={organization}
        renderDisabled={false}
      >
        {isDismissed ? null : (
          <StyledAlert
            icon={<IconInfo />}
            opaque={false}
            showIcon
            type="info"
            trailingItems={
              <StyledButton priority="link" size="sm" onClick={dismiss}>
                <IconClose color="gray500" size="sm" />
              </StyledButton>
            }
          >
            {tct('Start collecting the body of requests and responses. [link]', {
              link: (
                <ExternalLink
                  href="https://github.com/getsentry/sentry-javascript/issues/7103"
                  onClick={dismiss}
                >
                  {t('Learn More')}
                </ExternalLink>
              ),
            })}
          </StyledAlert>
        )}
      </Feature>
      <NetworkTable ref={containerRef}>
        <SplitPanel
          style={{
            gridTemplateRows: splitSize !== undefined ? `1fr auto ${splitSize}px` : '1fr',
          }}
        >
          {networkSpans ? (
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
                        unfilteredItems={networkSpans}
                        clearSearchTerm={clearSearchTerm}
                      >
                        {t('No network requests recorded')}
                      </NoRowRenderer>
                    )}
                    onScrollbarPresenceChange={onScrollbarPresenceChange}
                    onScroll={() => {
                      if (scrollToRow !== undefined) {
                        setScrollToRow(undefined);
                      }
                    }}
                    scrollToRow={scrollToRow}
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
          <Feature
            features={['session-replay-network-details']}
            organization={organization}
            renderDisabled={false}
          >
            <NetworkDetails
              {...resizableDrawerProps}
              isSetup={isNetworkDetailsSetup}
              item={detailDataIndex ? (items[detailDataIndex] as NetworkSpan) : null}
              onClose={() => setDetailRow('')}
              onScrollToRow={() => setScrollToRow(Number(detailRowIndex))}
              projectId={projectId}
              startTimestampMs={startTimestampMs}
            />
          </Feature>
        </SplitPanel>
      </NetworkTable>
    </FluidHeight>
  );
}

const SplitPanel = styled('div')`
  width: 100%;
  height: 100%;

  position: relative;
  display: grid;
  overflow: auto;
`;

const OverflowHidden = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
`;

const NetworkTable = styled(FluidHeight)`
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

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(1)};
`;

const StyledButton = styled(Button)`
  color: inherit;
`;

export default NetworkList;
