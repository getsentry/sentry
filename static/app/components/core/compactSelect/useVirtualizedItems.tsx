import {useRef} from 'react';
import type {Node} from '@react-types/shared';
import {useVirtualizer} from '@tanstack/react-virtual';

import type {FormSize} from 'sentry/utils/theme';

const heightEstimations = {
  sm: {regular: 32, large: 49},
  md: {regular: 36, large: 53},
  xs: {regular: 25, large: 42},
} as const satisfies Record<FormSize, {large: number; regular: number}>;

// explicitly using object here because Record<PropertyKey, unknown> requires an index signature
// eslint-disable-next-line @typescript-eslint/no-restricted-types
type ObjectLike = object;

export function useVirtualizedItems<T extends ObjectLike>({
  listItems,
  virtualized = false,
  size,
}: {
  listItems: Array<Node<T>>;
  size: FormSize;
  virtualized: boolean | undefined;
}) {
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const heightEstimation = heightEstimations[size];

  const virtualizer = useVirtualizer({
    count: listItems.length,
    getScrollElement: () => scrollElementRef?.current,
    estimateSize: index => {
      const item = listItems[index];
      if (item?.value && 'details' in item.value) {
        return heightEstimation.large;
      }
      return heightEstimation.regular;
    },
    enabled: virtualized,
  });

  if (virtualized) {
    const virtualizedItems = virtualizer.getVirtualItems();
    return {
      items: virtualizedItems,
      scrollElementRef,
      itemProps: (index: number) => ({
        ref: virtualizer.measureElement,
        'data-index': index,
      }),
      wrapperProps: {
        'data-is-virtualized': true,
        style: {
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        },
      },
      listWrapStyle: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${virtualizedItems[0]?.start ?? 0}px)`,
      },
    } as const;
  }

  return {
    items: listItems.map((_, index) => ({index, start: 0})),
    scrollElementRef: undefined,
    itemProps: () => undefined,
    wrapperProps: {
      'data-is-virtualized': false,
    },
    listWrapStyle: {},
  } as const;
}
