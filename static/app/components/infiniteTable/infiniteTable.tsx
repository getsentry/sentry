import {
  createContext,
  Fragment,
  useContext,
  useRef,
  useLayoutEffect,
  type HTMLAttributes,
} from 'react';
import styled from '@emotion/styled';
import type {UseInfiniteQueryResult} from '@tanstack/react-query';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

const ColumnContext = createContext('');
const ScrollableRefContext = createContext<React.RefObject<HTMLDivElement | null>>({
  current: null,
});

const Table = styled((props: HTMLAttributes<HTMLDivElement> & {columns: string}) => {
  const {children, columns, ...rest} = props;
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  return (
    <ColumnContext value={columns}>
      <ScrollableRefContext value={scrollBodyRef}>
        <Stack flex="1" overflow="hidden" border="muted" radius="md" {...rest}>
          {children}
        </Stack>
      </ScrollableRefContext>
    </ColumnContext>
  );
})`
  margin: 0;
  overflow: hidden;
  flex: 1;
`;

const Header = styled(({children, ...rest}: HTMLAttributes<HTMLDivElement>) => (
  <SimpleTable.Header
    {...rest}
    style={{...rest.style, gridTemplateColumns: useContext(ColumnContext)}}
  >
    {children}
  </SimpleTable.Header>
))`
  grid-column: unset;
  grid-row: unset;
  z-index: ${p => p.theme.zIndex.initial};
  height: min-content;
`;

const TableCellFirst = styled(SimpleTable.HeaderCell)`
  grid-column: 1;
`;

const TableCellsRemainingContent = styled(Flex)`
  grid-column: 2 / -1;
`;

const Scrollable = styled(({children, ...rest}: HTMLAttributes<HTMLDivElement>) => (
  <div ref={useContext(ScrollableRefContext)} {...rest}>
    {children}
  </div>
))`
  contain: size;
  position: relative;
  overflow-y: auto;
  flex: 1;
  height: 0;
`;

const BodyInner = styled('div')`
  position: relative;
  width: 100%;
`;

function Body<TData = unknown, TSelect = unknown>({
  children,
  estimateSize,
  queryResult,
  select,
}: {
  children: (item: TSelect) => React.ReactNode;
  estimateSize: () => number;
  queryResult: UseInfiniteQueryResult<TData>;
  select: (data: TData | undefined) => TSelect[];
}) {
  const scrollBodyRef = useContext(ScrollableRefContext);
  const selectedData = select(queryResult.data);
  const virtualizer = useVirtualizer({
    count: selectedData.length ?? 0,
    getScrollElement: () => scrollBodyRef?.current,
    estimateSize,
    overscan: 5,
  });

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer]);

  const columns = useContext(ColumnContext);

  return (
    <BodyInner style={{height: virtualizer.getTotalSize()}}>
      {virtualizer.getVirtualItems().map((virtualItem, index, arr) => {
        const item = selectedData[virtualItem.index];
        const row = item ? children(item) : null;
        return (
          <Grid
            key={virtualItem.index}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            columns={columns}
            align="center"
            style={{transform: `translateY(${virtualItem.start}px)`}}
            role="row"
            position="absolute"
            top="0"
            left="0"
            width="100%"
            borderBottom={index === arr.length - 1 ? undefined : 'muted'}
          >
            {row}
          </Grid>
        );
      })}
    </BodyInner>
  );
}

function LoadingRow({queryResult}: {queryResult: UseInfiniteQueryResult}) {
  if (queryResult.isFetchingNextPage) {
    return (
      <StickyLoadingRow align="center" justify="center" padding="md" borderTop="muted">
        <LoadingIndicator mini />
      </StickyLoadingRow>
    );
  }
  return null;
}

const StickyLoadingRow = styled(Flex)`
  position: sticky;
  bottom: 0;
  background: ${p => p.theme.tokens.background.primary};
`;

export const InfiniteTable = {
  Table,
  Header,
  HeaderCell: SimpleTable.HeaderCell,
  HeaderCellFirst: TableCellFirst,
  HeaderCellRemaining: TableCellsRemainingContent,
  Scrollable,
  Body,
  Empty: SimpleTable.Empty,
  LoadingRow,
  Row: Fragment,
  RowCell: SimpleTable.RowCell,
};
