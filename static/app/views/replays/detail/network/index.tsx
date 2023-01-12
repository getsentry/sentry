import {AutoSizer} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NetworkFilters from 'sentry/views/replays/detail/network/networkFilters';
import NetworkHeaderCell, {
  COLUMN_COUNT,
} from 'sentry/views/replays/detail/network/networkHeaderCell';
import NetworkTableCell from 'sentry/views/replays/detail/network/networkTableCell';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import VirtualGrid, {
  BodyRendererProps,
  HeaderRendererProps,
} from 'sentry/views/replays/detail/virtualGrid';
import type {NetworkSpan} from 'sentry/views/replays/types';

const HEADER_HEIGHT = 25;
const BODY_HEIGHT = 28;

type Props = {
  networkSpans: undefined | NetworkSpan[];
  startTimestampMs: number;
};

type ItemData = {
  current: ReturnType<typeof getPrevReplayEvent>;
  hovered: ReturnType<typeof getPrevReplayEvent>;
  startTimestampMs: Props['startTimestampMs'];
} & ReturnType<typeof useCrumbHandlers> &
  ReturnType<typeof useSortNetwork>;

const HeadCell = ({columnIndex, style, data}: HeaderRendererProps<ItemData>) => {
  const {handleSort, sortConfig} = data;
  return (
    <NetworkHeaderCell
      handleSort={handleSort}
      index={columnIndex}
      sortConfig={sortConfig}
      style={{...style}}
    />
  );
};

const BodyCell = ({columnIndex, rowIndex, style, data}: BodyRendererProps<ItemData>) => {
  const {
    items,
    current,
    handleClick,
    handleMouseEnter,
    handleMouseLeave,
    hovered,
    sortConfig,
    startTimestampMs,
  } = data;
  const network = items[rowIndex];
  return (
    <NetworkTableCell
      columnIndex={columnIndex}
      handleClick={handleClick}
      handleMouseEnter={handleMouseEnter}
      handleMouseLeave={handleMouseLeave}
      isCurrent={network.id === current?.id}
      isHovered={network.id === hovered?.id}
      sortConfig={sortConfig}
      span={network}
      startTimestampMs={startTimestampMs}
      style={{...style, height: BODY_HEIGHT}}
    />
  );
};

function NetworkList({networkSpans, startTimestampMs}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const filterProps = useNetworkFilters({networkSpans: networkSpans || []});
  const {items: filteredItems, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');
  const sortResult = useSortNetwork({items: filteredItems});
  const {items} = sortResult;

  const crumbHandlers = useCrumbHandlers(startTimestampMs);

  const current = getPrevReplayEvent({
    items,
    targetTimestampMs: startTimestampMs + currentTime,
    allowEqual: true,
    allowExact: true,
  });

  const hovered = currentHoverTime
    ? getPrevReplayEvent({
        items,
        targetTimestampMs: startTimestampMs + currentHoverTime,
        allowEqual: true,
        allowExact: true,
      })
    : undefined;

  return (
    <NetworkContainer>
      <NetworkFilters networkSpans={networkSpans} {...filterProps} />
      <NetworkTable>
        {networkSpans ? (
          <AutoSizer>
            {({width, height}) =>
              items.length ? (
                <VirtualGrid<ItemData>
                  itemData={{
                    current,
                    hovered,
                    startTimestampMs,
                    ...sortResult,
                    ...crumbHandlers,
                  }}
                  bodyRenderer={BodyCell}
                  columnCount={COLUMN_COUNT}
                  columnWidth={() => 100}
                  headerHeight={`${HEADER_HEIGHT}px`}
                  headerRenderer={HeadCell}
                  height={height}
                  rowCount={items.length}
                  rowHeight={() => BODY_HEIGHT}
                  width={width}
                />
              ) : (
                <div style={{width, height}}>
                  <NoRowRenderer
                    unfilteredItems={networkSpans}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No network requests recorded')}
                  </NoRowRenderer>
                </div>
              )
            }
          </AutoSizer>
        ) : (
          <Placeholder height="100%" />
        )}
      </NetworkTable>
    </NetworkContainer>
  );
}

const NetworkContainer = styled(FluidHeight)`
  height: 100%;
`;

const NetworkTable = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default NetworkList;
