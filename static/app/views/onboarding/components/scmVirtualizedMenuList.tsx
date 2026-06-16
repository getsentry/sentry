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

import {type Ref, useRef} from 'react';
import {mergeRefs} from '@react-aria/utils';
import {useVirtualizer} from '@tanstack/react-virtual';

const OPTION_HEIGHT = 36;
const MAX_MENU_HEIGHT = 300;

interface ScmVirtualizedMenuListProps {
  children: React.ReactNode;
  innerProps?: React.HTMLAttributes<HTMLDivElement>;
  innerRef?: Ref<HTMLDivElement>;
  maxHeight?: number;
  optionHeight?: number;
}

export function ScmVirtualizedMenuList({
  children,
  maxHeight = MAX_MENU_HEIGHT,
  optionHeight = OPTION_HEIGHT,
  innerRef,
  innerProps,
}: ScmVirtualizedMenuListProps) {
  const items = Array.isArray(children) ? children : [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const combinedRef = mergeRefs(scrollRef, innerRef ?? null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => optionHeight,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

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
    <div ref={combinedRef} {...innerProps} style={{maxHeight, overflowY: 'auto'}}>
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
