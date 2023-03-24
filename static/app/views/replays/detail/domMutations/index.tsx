import {memo, useMemo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useExtractedCrumbHtml from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import DomFilters from 'sentry/views/replays/detail/domMutations/domFilters';
import DomMutationRow from 'sentry/views/replays/detail/domMutations/domMutationRow';
import useDomFilters from 'sentry/views/replays/detail/domMutations/useDomFilters';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

type Props = {
  replay: null | ReplayReader;
  startTimestampMs: number;
};

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 82,
};

function DomMutations({replay, startTimestampMs}: Props) {
  const {isLoading, actions} = useExtractedCrumbHtml({replay});
  const {currentTime, currentHoverTime} = useReplayContext();

  const filterProps = useDomFilters({actions: actions || []});
  const {items, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  const listRef = useRef<ReactVirtualizedList>(null);

  const itemLookup = useMemo(
    () =>
      items &&
      items
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
    [items]
  );

  const breadcrumbs = useMemo(() => items.map(({crumb}) => crumb), [items]);
  const current = useMemo(
    () =>
      getPrevReplayEvent({
        itemLookup,
        items: breadcrumbs,
        targetTimestampMs: startTimestampMs + currentTime,
      }),
    [itemLookup, breadcrumbs, currentTime, startTimestampMs]
  );

  const hovered = useMemo(
    () =>
      currentHoverTime
        ? getPrevReplayEvent({
            itemLookup,
            items: breadcrumbs,
            targetTimestampMs: startTimestampMs + currentHoverTime,
          })
        : null,
    [itemLookup, breadcrumbs, currentHoverTime, startTimestampMs]
  );

  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps: [items],
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
          isCurrent={mutation.crumb.id === current?.id}
          isHovered={mutation.crumb.id === hovered?.id}
          mutation={mutation}
          mutations={items}
          startTimestampMs={startTimestampMs}
          style={style}
        />
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <DomFilters actions={actions} {...filterProps} />
      <MutationItemContainer>
        {isLoading || !actions ? (
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
      </MutationItemContainer>
    </FluidHeight>
  );
}

const MutationItemContainer = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default memo(DomMutations);
