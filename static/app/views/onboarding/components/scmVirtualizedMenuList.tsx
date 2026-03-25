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

import {useRef} from 'react';
import {useVirtualizer} from '@tanstack/react-virtual';

const OPTION_HEIGHT = 36;
const MAX_MENU_HEIGHT = 300;
export function ScmVirtualizedMenuList(props: {
  children: React.ReactNode;
  maxHeight: number;
}) {
  const {children, maxHeight} = props;
  const items = Array.isArray(children) ? children : [];
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => OPTION_HEIGHT,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollRef}
      style={{maxHeight: maxHeight || MAX_MENU_HEIGHT, overflowY: 'auto'}}
    >
      {virtualItems.length > 0 ? (
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
      ) : (
        // Fallback: render all items when virtualizer can't measure (JSDOM)
        items
      )}
    </div>
  );
}
