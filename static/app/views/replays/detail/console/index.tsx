import {useEffect} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import ConsoleFilters from 'sentry/views/replays/detail/console/consoleFilters';
import ConsoleMessage from 'sentry/views/replays/detail/console/consoleMessage';
import useConsoleFilters from 'sentry/views/replays/detail/console/useConsoleFilters';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';

interface Props {
  breadcrumbs: undefined | Extract<Crumb, BreadcrumbTypeDefault>[];
  startTimestampMs: number;
}

const cache = new CellMeasurerCache({
  fixedWidth: true,
  minHeight: 24,
});

function Console({breadcrumbs, startTimestampMs}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();
  let listRef: ReactVirtualizedList | null = null;

  const filterProps = useConsoleFilters({breadcrumbs: breadcrumbs || []});
  const {items, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

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
    : null;

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  useEffect(() => {
    // Restart cache when items changes
    if (listRef) {
      cache.clearAll();
      listRef?.forceUpdateGrid();
    }
  }, [items, listRef]);

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
        <ConsoleMessage
          isCurrent={item.id === current?.id}
          isHovered={item.id === hovered?.id}
          breadcrumb={item}
          onClickTimestamp={() => handleClick(item)}
          onMouseEnter={() => handleMouseEnter(item)}
          onMouseLeave={() => handleMouseLeave(item)}
          startTimestampMs={startTimestampMs}
          style={style}
        />
      </CellMeasurer>
    );
  };

  return (
    <ConsoleContainer>
      <ConsoleFilters breadcrumbs={breadcrumbs} {...filterProps} />
      <ConsoleMessageContainer>
        {breadcrumbs ? (
          <AutoSizer>
            {({width, height}) => (
              <ReactVirtualizedList
                ref={(el: ReactVirtualizedList | null) => {
                  listRef = el;
                }}
                deferredMeasurementCache={cache}
                height={height}
                overscanRowCount={5}
                rowCount={items.length}
                noRowsRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={breadcrumbs}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No console logs recorded')}
                  </NoRowRenderer>
                )}
                rowHeight={cache.rowHeight}
                rowRenderer={renderRow}
                width={width}
              />
            )}
          </AutoSizer>
        ) : (
          <Placeholder height="100%" />
        )}
      </ConsoleMessageContainer>
    </ConsoleContainer>
  );
}

const ConsoleContainer = styled(FluidHeight)`
  height: 100%;
`;

const ConsoleMessageContainer = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default Console;
