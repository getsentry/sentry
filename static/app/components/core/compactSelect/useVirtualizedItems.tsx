import {useRef} from 'react';
import type {Node} from '@react-types/shared';
import {useVirtualizer} from '@tanstack/react-virtual';

import type {FormSize} from 'sentry/utils/theme';

import type {SelectKey} from './types';

// explicitly using object here because Record<PropertyKey, unknown> requires an index signature
// eslint-disable-next-line @typescript-eslint/no-restricted-types
type ObjectLike = object;

export const heightEstimations = {
  sm: {regular: 32, large: 49},
  md: {regular: 36, large: 53},
  xs: {regular: 25, large: 42},
} as const satisfies Record<FormSize, {large: number; regular: number}>;

/**
 * Approximate height of section header in pixels per size.
 * SectionHeader: height 1.5em + padding 2xs top/bottom (content-box) ≈ 28px at md.
 */
export const sectionHeaderHeights = {
  xs: 22,
  sm: 26,
  md: 28,
} as const satisfies Record<FormSize, number>;

/**
 * Approximate height of section separator in pixels.
 * SectionSeparator: 1px border-top + xs margin top/bottom ≈ 9px.
 */
export const SECTION_SEPARATOR_HEIGHT = 9;

export function useVirtualizedItems<T extends ObjectLike>({
  listItems,
  virtualized = false,
  size,
  hiddenOptions,
  showSectionHeaders,
}: {
  listItems: Array<Node<T>>;
  size: FormSize;
  virtualized: boolean | undefined;
  hiddenOptions?: Set<SelectKey>;
  showSectionHeaders?: boolean;
}) {
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const heightEstimation = heightEstimations[size];

  const virtualizer = useVirtualizer({
    count: listItems.length,
    getScrollElement: () => scrollElementRef?.current,
    estimateSize: index => {
      const item = listItems[index];
      if (item?.type === 'section') {
        const visibleChildren = hiddenOptions
          ? [...item.childNodes].filter(c => !hiddenOptions.has(c.key)).length
          : [...item.childNodes].length;
        const headerHeight = showSectionHeaders ? sectionHeaderHeights[size] : 0;
        const separatorHeight = index > 0 ? SECTION_SEPARATOR_HEIGHT : 0;
        return (
          separatorHeight + headerHeight + visibleChildren * heightEstimation.regular
        );
      }
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
