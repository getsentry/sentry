import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import type {InfiniteData, UseInfiniteQueryResult} from '@tanstack/react-query';
import {useVirtualizer, type VirtualItem} from '@tanstack/react-virtual';

import {Stack} from '@sentry/scraps/layout';

import type {ApiResult} from 'sentry/api';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

/**
 * Types:
 *   - ListItem represents the type of a single item in the list, after being extracted and de-duplicated from the response
 *   - Response represents the type of the response from the API. For example: `ApiResult<ListItem[]>` or `ApiResult<{data: ListItem[]}>`
 *
 * `deduplicateItems` is a function to transform Response into an array of ListItem objects. For the most common cases:
 *   - When `Response = ApiResult<ListItem[]>` then `deduplicateItems={pages => uniqBy(pages.flatMap(page => page[0]), 'id')}`
 *   - When `Response = ApiResult<{data: ListItem[]}>` then `deduplicateItems={pages => uniqBy(pages.flatMap(page => page[0].data), 'id')}`
 */
interface Props<ListItem, Response = Array<ApiResult<ListItem[]>>> {
  deduplicateItems: (page: Response[]) => ListItem[];
  itemRenderer: ({
    item,
    virtualItem,
  }: {
    item: ListItem;
    virtualItem: VirtualItem;
  }) => React.ReactNode;
  queryResult: Overwrite<
    Pick<
      UseInfiniteQueryResult<InfiniteData<Response>, Error>,
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

export default function InfiniteListItems<
  ListItem,
  Response = Array<ApiResult<ListItem[]>>,
>({
  deduplicateItems,
  emptyMessage = EmptyMessage,
  estimateSize,
  itemRenderer,
  loadingCompleteMessage = LoadingCompleteMessage,
  loadingMoreMessage = LoadingMoreMessage,
  overscan,
  queryResult,
}: Props<ListItem, Response>) {
  const {data, hasNextPage, isFetchingNextPage, fetchNextPage} = queryResult;
  const loadedRows = deduplicateItems(data?.pages ?? []);
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
    <FlexOverscroll ref={parentRef} data-scrollable>
      <Stack
        width="100%"
        position="absolute"
        style={{height: rowVirtualizer.getTotalSize()}}
      >
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
      </Stack>
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
