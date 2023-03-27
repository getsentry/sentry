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
import type {Crumb} from 'sentry/types/breadcrumbs';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import BreadcrumbRow from 'sentry/views/replays/detail/breadcrumbs/breadcrumbRow';
import useScrollToCurrentItem from 'sentry/views/replays/detail/breadcrumbs/useScrollToCurrentItem';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

type Props = {
  breadcrumbs: undefined | Crumb[];
  startTimestampMs: number;
};

// Ensure this object is created once as it is an input to
// `useVirtualizedList`'s memoization
const cellMeasurer = {
  fixedWidth: true,
  minHeight: 53,
};

function Breadcrumbs({breadcrumbs, startTimestampMs}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();
  const items = useMemo(
    () =>
      (breadcrumbs || []).filter(crumb => !['console'].includes(crumb.category || '')),
    [breadcrumbs]
  );

  const listRef = useRef<ReactVirtualizedList>(null);

  const itemLookup = useMemo(
    () =>
      breadcrumbs &&
      breadcrumbs
        .map(({timestamp}, i) => [+new Date(timestamp || ''), i])
        .sort(([a], [b]) => a - b),
    [breadcrumbs]
  );

  const current = useMemo(
    () =>
      breadcrumbs
        ? getPrevReplayEvent({
            itemLookup,
            items: breadcrumbs,
            targetTimestampMs: startTimestampMs + currentTime,
          })
        : undefined,
    [itemLookup, breadcrumbs, currentTime, startTimestampMs]
  );

  const hovered = useMemo(
    () =>
      currentHoverTime && breadcrumbs
        ? getPrevReplayEvent({
            itemLookup,
            items: breadcrumbs,
            targetTimestampMs: startTimestampMs + currentHoverTime,
          })
        : undefined,
    [itemLookup, breadcrumbs, currentHoverTime, startTimestampMs]
  );

  const {cache, updateList} = useVirtualizedList({
    cellMeasurer,
    ref: listRef,
    deps: [items],
  });

  useScrollToCurrentItem({
    breadcrumbs,
    ref: listRef,
    startTimestampMs,
  });

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const item = items[index];

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <BreadcrumbRow
          isCurrent={current?.id === item.id}
          isHovered={hovered?.id === item.id}
          breadcrumb={item}
          startTimestampMs={startTimestampMs}
          style={style}
        />
      </CellMeasurer>
    );
  };

  return (
    <FluidHeight>
      <BreadcrumbContainer>
        {breadcrumbs ? (
          <AutoSizer onResize={updateList}>
            {({height, width}) => (
              <ReactVirtualizedList
                deferredMeasurementCache={cache}
                height={height}
                noRowsRenderer={() => (
                  <NoRowRenderer unfilteredItems={breadcrumbs} clearSearchTerm={() => {}}>
                    {t('No breadcrumbs recorded')}
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
        ) : (
          <Placeholder height="100%" />
        )}
      </BreadcrumbContainer>
    </FluidHeight>
  );
}

const BreadcrumbContainer = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default memo(Breadcrumbs);
