import {memo, useMemo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import {useQuery} from '@tanstack/react-query';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import DomFilters from 'sentry/views/replays/detail/domMutations/domFilters';
import DomMutationRow from 'sentry/views/replays/detail/domMutations/domMutationRow';
import useDomFilters from 'sentry/views/replays/detail/domMutations/useDomFilters';
import FilterLoadingIndicator from 'sentry/views/replays/detail/filterLoadingIndicator';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 82,
};

function useExtractedDomNodes({replay}: {replay: null | ReplayReader}) {
  return useQuery(['getDomNodes', replay], () => replay?.getDomNodes() ?? [], {
    enabled: Boolean(replay),
    initialData: [],
    cacheTime: Infinity,
  });
}

function DomMutations() {
  const {currentTime, currentHoverTime, replay} = useReplayContext();
  const {data: actions, isFetching} = useExtractedDomNodes({replay});
  const {onMouseEnter, onMouseLeave, onClickTimestamp} = useCrumbHandlers();

  const startTimestampMs = replay?.getReplay()?.started_at?.getTime() ?? 0;

  const filterProps = useDomFilters({actions: actions || []});
  const {items, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  const listRef = useRef<ReactVirtualizedList>(null);

  const deps = useMemo(() => [items], [items]);
  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps,
  });

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const mutation = items[index];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <DomMutationRow
          currentHoverTime={currentHoverTime}
          currentTime={currentTime}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          mutation={mutation}
          onClickTimestamp={onClickTimestamp}
          startTimestampMs={startTimestampMs}
          style={style}
        />
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <FilterLoadingIndicator isLoading={isFetching}>
        <DomFilters actions={actions} {...filterProps} />
      </FilterLoadingIndicator>
      <TabItemContainer data-test-id="replay-details-dom-events-tab">
        {isFetching || !actions ? (
          <Placeholder height="100%" />
        ) : (
          <AutoSizer onResize={updateList}>
            {({width, height}) => (
              <ReactVirtualizedList
                deferredMeasurementCache={cache}
                height={height}
                noRowsRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={actions}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No DOM events recorded')}
                  </NoRowRenderer>
                )}
                overscanRowCount={5}
                ref={listRef}
                rowCount={items.length}
                rowHeight={cache.rowHeight}
                rowRenderer={renderRow}
                width={width}
              />
            )}
          </AutoSizer>
        )}
      </TabItemContainer>
    </FluidHeight>
  );
}

export default memo(DomMutations);
