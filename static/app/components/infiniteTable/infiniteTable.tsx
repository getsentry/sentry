import type {ReactNode} from 'react';
import {Fragment, useLayoutEffect} from 'react';
import styled from '@emotion/styled';
import type {UseInfiniteQueryResult} from '@tanstack/react-query';
import {useVirtualizer} from '@tanstack/react-virtual';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {Table as TableShell, useTableElement} from 'sentry/components/tables/table';

function Body<TData = unknown, TSelect = unknown>({
  children,
  estimateSize,
  queryResult,
  select,
}: {
  children: (item: TSelect) => ReactNode;
  estimateSize: () => number;
  queryResult: UseInfiniteQueryResult<TData>;
  select: (data: TData | undefined) => TSelect[];
}) {
  const tableRef = useTableElement();
  const selectedData = select(queryResult.data);
  const virtualizer = useVirtualizer({
    count: selectedData.length,
    getScrollElement: () => tableRef.current,
    estimateSize,
    overscan: 5,
  });

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const firstItem = virtualItems[0];
  const lastItem = virtualItems[virtualItems.length - 1];

  return (
    <VirtualBody
      style={{
        paddingTop: firstItem?.start ?? 0,
        paddingBottom: lastItem ? virtualizer.getTotalSize() - lastItem.end : 0,
      }}
    >
      {virtualItems.map(virtualItem => {
        const item = selectedData[virtualItem.index];

        return item === undefined ? null : (
          <VirtualRow
            divider
            key={virtualItem.index}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
          >
            {children(item)}
          </VirtualRow>
        );
      })}
    </VirtualBody>
  );
}

function LoadingRow({queryResult}: {queryResult: UseInfiniteQueryResult}) {
  return queryResult.isFetchingNextPage ? (
    <LoadingBody>
      <LoadingIndicator mini />
    </LoadingBody>
  ) : null;
}

const Table = styled(TableShell)`
  align-content: start;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  flex: 1;
  min-height: 0;
  overflow: auto;
  width: 100%;
`;

const HeaderCellRemaining = styled(TableShell.Cell)`
  align-items: center;
  display: flex;
  gap: ${p => p.theme.space.md};
  grid-column: 2 / -1;
  padding: 0 ${p => p.theme.space.xl};
`;

const VirtualBody = styled(TableShell.Body)`
  align-content: start;
`;

const VirtualRow = styled(TableShell.Row)`
  align-items: center;
`;

const Status = styled(TableShell.StatusBody)`
  min-height: 200px;
  padding: ${p => p.theme.space.xl};
`;

const Empty = styled(Status)`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
`;

const LoadingBody = styled(TableShell.StatusBody)`
  background: ${p => p.theme.tokens.background.primary};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  bottom: 0;
  padding: ${p => p.theme.space.md};
  position: sticky;
`;

export const InfiniteTable = {
  Table,
  Head: TableShell.Head,
  Header: SimpleTable.Header,
  HeaderBanner: TableShell.Status,
  HeaderCell: SimpleTable.HeaderCell,
  HeaderCellFirst: SimpleTable.HeaderCellFirst,
  HeaderCellRemaining,
  Body,
  Empty,
  LoadingRow,
  Row: Fragment,
  RowCell: SimpleTable.RowCell,
  Status,
};
