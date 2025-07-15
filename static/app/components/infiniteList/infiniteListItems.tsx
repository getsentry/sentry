import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import type {InfiniteData, UseInfiniteQueryResult} from '@tanstack/react-query';
import {useVirtualizer, type VirtualItem} from '@tanstack/react-virtual';

import type {ApiResult} from 'sentry/api';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

interface Props<Data> {
  itemRenderer: ({
    item,
    virtualItem,
  }: {
    item: Data;
    virtualItem: VirtualItem;
  }) => React.ReactNode;
  queryResult: Overwrite<
    Pick<
      UseInfiniteQueryResult<InfiniteData<ApiResult<Data[]>>, Error>,
      'data' | 'hasNextPage' | 'isFetchingNextPage' | 'fetchNextPage'
    >,
    {fetchNextPage: () => Promise<unknown>}
  >;
  emptyMessage?: () => React.ReactNode;
  estimateSize?: () => number;
  loadingCompleteMessage?: () => React.ReactNode;
  loadingMoreMessage?: () => React.ReactNode;
  overscan?: number;
}

export default function InfiniteListItems<Data>({
  estimateSize,
  itemRenderer,
  emptyMessage = EmptyMessage,
  loadingCompleteMessage = LoadingCompleteMessage,
  loadingMoreMessage = LoadingMoreMessage,
  overscan,
  queryResult,
}: Props<Data>) {
  const {data, hasNextPage, isFetchingNextPage, fetchNextPage} = queryResult;
  const loadedRows = data ? data.pages.flatMap(d => d[0]) : [];
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? loadedRows.length + 1 : loadedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateSize ?? (() => 100),
    overscan: overscan ?? 5,
  });
  const items = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = items.at(-1);
    if (!lastItem) {
      return;
    }

    if (lastItem.index >= loadedRows.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, loadedRows.length, isFetchingNextPage, items]);

  return (
    <FlexOverscroll ref={parentRef}>
      <FlexListContainer style={{height: rowVirtualizer.getTotalSize()}}>
        <PositionedList style={{transform: `translateY(${items[0]?.start ?? 0}px)`}}>
          {items.length ? null : emptyMessage()}
          {items.map(virtualItem => {
            const isLoaderRow = virtualItem.index > loadedRows.length - 1;
            const item = loadedRows.at(virtualItem.index);

            return (
              <li
                data-index={virtualItem.index}
                key={virtualItem.index}
                ref={rowVirtualizer.measureElement}
              >
                {isLoaderRow
                  ? hasNextPage
                    ? loadingMoreMessage()
                    : loadingCompleteMessage()
                  : item && itemRenderer({virtualItem, item})}
              </li>
            );
          })}
        </PositionedList>
      </FlexListContainer>
    </FlexOverscroll>
  );
}

function EmptyMessage() {
  return <p>{t('No items to show')}</p>;
}

function LoadingMoreMessage() {
  return (
    <Footer title={t('Loading more items...')}>
      <LoadingIndicator size={20} />
    </Footer>
  );
}

function LoadingCompleteMessage() {
  return <p>{t('Nothing more to load')}</p>;
}

const FlexOverscroll = styled('div')`
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  overflow: auto;
  overscroll-behavior: contain;
  contain: strict;
`;

const FlexListContainer = styled('div')`
  position: absolute;
  display: flex;
  width: 100%;
  flex-direction: column;
`;

const PositionedList = styled('ul')`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;

  margin: 0;
  padding: 0;
  list-style: none;
  & > li {
    margin: 0;
    padding: 0;
  }
`;

const Footer = styled('footer')`
  position: absolute;
  bottom: 0;
  z-index: ${p => p.theme.zIndex.initial};
  display: flex;
  width: 100%;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
`;
