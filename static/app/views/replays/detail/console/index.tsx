import {memo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
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
  const filterProps = useConsoleFilters({breadcrumbs: breadcrumbs || []});
  const {items, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  const listRef = useRef<ReactVirtualizedList>(null);
  const {cache} = useVirtualizedList({
    cellMeasurer: {
      fixedWidth: true,
      minHeight: 24,
    },
    ref: listRef,
    deps: [items],
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
        <ConsoleLogRow
          breadcrumb={item}
          breadcrumbs={items}
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
                deferredMeasurementCache={cache}
                height={height}
                noRowsRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={breadcrumbs}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No console logs recorded')}
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

export default memo(Console);
