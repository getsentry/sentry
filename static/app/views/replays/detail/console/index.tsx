import {useRef} from 'react';
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
import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import ConsoleFilters from 'sentry/views/replays/detail/console/consoleFilters';
import ConsoleLogRow from 'sentry/views/replays/detail/console/consoleLogRow';
import useConsoleFilters from 'sentry/views/replays/detail/console/useConsoleFilters';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

interface Props {
  breadcrumbs: undefined | Extract<Crumb, BreadcrumbTypeDefault>[];
  startTimestampMs: number;
}

function Console({breadcrumbs, startTimestampMs}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();

  const filterProps = useConsoleFilters({breadcrumbs: breadcrumbs || []});
  const {items, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

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

  const listRef = useRef<ReactVirtualizedList>(null);
  const {cache} = useVirtualizedList({listRef, deps: [items]});

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
        <ConsoleLogRow
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
      <ConsoleLogContainer>
        {breadcrumbs ? (
          <AutoSizer>
            {({width, height}) => (
              <ReactVirtualizedList
                ref={listRef}
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
      </ConsoleLogContainer>
    </ConsoleContainer>
  );
}

const ConsoleContainer = styled(FluidHeight)`
  height: 100%;
`;

const ConsoleLogContainer = styled('div')`
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

export default Console;
