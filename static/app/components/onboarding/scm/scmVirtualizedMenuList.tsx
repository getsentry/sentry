/**
 * Virtualized MenuList for the Select (react-select) component.
 * react-select re-renders every Option on hover/focus changes, which
 * causes ~1s lag with 130+ platform options containing PlatformIcon SVGs.
 * Virtualizing limits mounted components to the visible set.
 *
 * Stopgap until a Combobox scraps component replaces this
 * (see #discuss-design-engineering).
 *
 * Usage: <Select components={{MenuList: ScmVirtualizedMenuList}} />
 */

import {isValidElement, type Ref, useEffect, useRef} from 'react';
import {getInteractionModality} from '@react-aria/interactions';
import {mergeRefs} from '@react-aria/utils';
import {useVirtualizer} from '@tanstack/react-virtual';

const OPTION_HEIGHT = 36;
const MAX_MENU_HEIGHT = 300;
const MENU_PADDING = 4;

interface ScmVirtualizedMenuListProps {
  children: React.ReactNode;
  focusedOption?: unknown;
  innerProps?: React.HTMLAttributes<HTMLDivElement>;
  innerRef?: Ref<HTMLDivElement>;
  maxHeight?: number;
  optionHeight?: number;
}

export function ScmVirtualizedMenuList({
  children,
  focusedOption,
  maxHeight = MAX_MENU_HEIGHT,
  optionHeight = OPTION_HEIGHT,
  innerRef,
  innerProps,
}: ScmVirtualizedMenuListProps) {
  const items: React.ReactNode[] = Array.isArray(children) ? children : [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const combinedRef = mergeRefs(scrollRef, innerRef ?? null);
  const visibleOptionCount = Math.max(
    1,
    Math.floor((maxHeight - MENU_PADDING * 2) / optionHeight)
  );
  const alignedMaxHeight = visibleOptionCount * optionHeight + MENU_PADDING * 2;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => optionHeight,
    overscan: 5,
    paddingStart: MENU_PADDING,
    paddingEnd: MENU_PADDING,
    scrollPaddingStart: MENU_PADDING,
    scrollPaddingEnd: MENU_PADDING,
  });

  const virtualItems = virtualizer.getVirtualItems();
  // react-select shares focused option identity with each Option child's data.
  // The focused DOM node may be virtualized out, so scroll by its child index.
  const focusedIndex = items.findIndex(
    item => isValidElement<{data?: unknown}>(item) && item.props.data === focusedOption
  );

  useEffect(() => {
    if (focusedIndex !== -1 && getInteractionModality() !== 'pointer') {
      virtualizer.scrollToIndex(focusedIndex, {align: 'auto'});
    }
  }, [focusedIndex, virtualizer]);

  // When no options match, react-select passes a single NoOptionsMessage
  // element (not an array). Render it directly without virtualization.
  if (!Array.isArray(children)) {
    return (
      <div ref={innerRef} {...innerProps} style={{maxHeight, overflowY: 'auto'}}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={combinedRef}
      {...innerProps}
      style={{maxHeight: alignedMaxHeight, overflowY: 'auto'}}
    >
      <div style={{height: virtualizer.getTotalSize(), position: 'relative'}}>
        {virtualItems.map(virtualRow => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {items[virtualRow.index]}
          </div>
        ))}
      </div>
    </div>
  );
}
