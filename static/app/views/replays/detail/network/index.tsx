import {useMemo, useRef} from 'react';
import {AutoSizer, CellMeasurer, GridCellProps, MultiGrid} from 'react-virtualized';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NetworkDetails from 'sentry/views/replays/detail/network/networkDetails';
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

type Props = {
  networkSpans: undefined | NetworkSpan[];
  startTimestampMs: number;
};

const cellMeasurer = {
  defaultHeight: BODY_HEIGHT,
  defaultWidth: 100,
  fixedHeight: true,
};

function NetworkList({networkSpans, startTimestampMs}: Props) {
  const organization = useOrganization();
  const {currentTime, currentHoverTime} = useReplayContext();

  const initialRequestDetailsHeight = useMemo(
    () => Math.max(150, window.innerHeight * 0.25),
    []
  );

  const filterProps = useNetworkFilters({networkSpans: networkSpans || []});
  const {items: filteredItems, searchTerm, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const {handleSort, items, sortConfig} = useSortNetwork({items: filteredItems});

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const itemLookup = useMemo(
    () =>
      items &&
      items
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
    [items]
  );

  const current = useMemo(
    () =>
      getPrevReplayEvent({
        itemLookup,
        items,
        targetTimestampMs: startTimestampMs + currentTime,
      }),
    [itemLookup, items, currentTime, startTimestampMs]
  );

  const hovered = useMemo(
    () =>
      currentHoverTime
        ? getPrevReplayEvent({
            itemLookup,
            items,
            targetTimestampMs: startTimestampMs + currentHoverTime,
          })
        : null,
    [itemLookup, items, currentHoverTime, startTimestampMs]
  );

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
              ref={e => e && registerChild?.(e)}
              columnIndex={columnIndex}
              handleClick={handleClick}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              isCurrent={network.id === current?.id}
              isHovered={network.id === hovered?.id}
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
      <NetworkTable>
        <FluidHeight>
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
              initialHeight={initialRequestDetailsHeight}
              items={items}
              startTimestampMs={startTimestampMs}
            />
          </Feature>
        </FluidHeight>
      </NetworkTable>
    </FluidHeight>
  );
}

const OverflowHidden = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
`;

const NetworkTable = styled(OverflowHidden)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default NetworkList;
