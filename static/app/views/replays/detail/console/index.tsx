import {useEffect} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import ConsoleMessage from 'sentry/views/replays/detail/console/consoleMessage';
import ConsoleFilters from 'sentry/views/replays/detail/console/filters';
import useConsoleFilters from 'sentry/views/replays/detail/console/useConsoleFilters';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props {
  breadcrumbs: undefined | Extract<Crumb, BreadcrumbTypeDefault>[];
  startTimestampMs: number;
}

const cache = new CellMeasurerCache({
  fixedWidth: true,
  minHeight: 24,
});

function Console({breadcrumbs, startTimestampMs}: Props) {
  const {currentTime} = useReplayContext();
  const filterProps = useConsoleFilters({breadcrumbs: breadcrumbs || []});

  let listRef: ReactVirtualizedList | null = null;

  useEffect(() => {
    // Restart cache when items changes
    if (listRef) {
      cache.clearAll();
      listRef?.forceUpdateGrid();
    }
  }, [filterProps.items, listRef]);

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const breadcrumb = filterProps.items[index];
    const hasOccurred =
      currentTime >= relativeTimeInMs(breadcrumb.timestamp || '', startTimestampMs);

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <ConsoleMessage
          style={style}
          isActive={false} // closestUserAction?.id === breadcrumb.id}
          isCurrent={false} // currentUserAction?.id === breadcrumb.id}
          isOcurring={false} // isOcurring(breadcrumb, closestUserAction)}
          startTimestampMs={startTimestampMs}
          isLast={index === breadcrumbs!.length - 1}
          breadcrumb={breadcrumb}
          hasOccurred={hasOccurred}
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
                rowCount={filterProps.items.length}
                noRowsRenderer={() =>
                  breadcrumbs.length === 0 ? (
                    <StyledEmptyStateWarning>
                      <p>{t('No console logs recorded')}</p>
                    </StyledEmptyStateWarning>
                  ) : (
                    <StyledEmptyStateWarning>
                      <p>{t('No results found')}</p>
                      <Button
                        icon={<IconClose color="gray500" size="sm" isCircled />}
                        onClick={() => filterProps.setSearchTerm('')}
                        size="md"
                      >
                        {t('Clear filters')}
                      </Button>
                    </StyledEmptyStateWarning>
                  )
                }
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

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

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
