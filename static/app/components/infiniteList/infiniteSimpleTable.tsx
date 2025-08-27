import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import type {InfiniteData, UseInfiniteQueryResult} from '@tanstack/react-query';
import {useVirtualizer, type VirtualItem} from '@tanstack/react-virtual';

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
  queryResult: Overwrite<
    Pick<
      UseInfiniteQueryResult<InfiniteData<Response>, Error>,
      'data' | 'hasNextPage' | 'isFetchingNextPage' | 'fetchNextPage'
    >,
    {fetchNextPage: () => Promise<unknown>}
  >;
  rowRenderer: ({
    item,
    virtualRow,
  }: {
    item: ListItem;
    virtualRow: VirtualItem;
  }) => React.ReactNode;
  emptyMessage?: () => React.ReactNode;
  estimateSize?: () => number;
  loadingCompleteMessage?: () => React.ReactNode;
  loadingMoreMessage?: () => React.ReactNode;
  overscan?: number;
}

export default function InfiniteSimpleTable<
  ListItem,
  Response = Array<ApiResult<ListItem[]>>,
>({
  deduplicateItems,
  emptyMessage = EmptyMessage,
  estimateSize,
  rowRenderer,
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
  const rows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    const lastRow = rows.at(-1);
    if (!lastRow) {
      return;
    }

    if (lastRow.index >= loadedRows.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, loadedRows.length, isFetchingNextPage, rows]);

  return (
    <FlexOverscroll ref={parentRef}>
      <FlexListContainer style={{height: rowVirtualizer.getTotalSize()}}>
        {rows.length ? null : emptyMessage()}
        {rows.map((virtualRow, index) => {
          const isLoaderRow = virtualRow.index > loadedRows.length - 1;
          const item = loadedRows.at(virtualRow.index);

          return (
            <li
              data-index={virtualRow.index}
              key={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start - index * virtualRow.size}px)`,
              }}
            >
              {isLoaderRow
                ? hasNextPage
                  ? loadingMoreMessage()
                  : loadingCompleteMessage()
                : item && rowRenderer({virtualRow, item})}
            </li>
          );
        })}
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

const FlexListContainer = styled('ul')`
  position: absolute;
  display: flex;
  width: 100%;
  flex-direction: column;

  margin: 0;
  padding: 0;
  list-style: none;
  & > * {
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
