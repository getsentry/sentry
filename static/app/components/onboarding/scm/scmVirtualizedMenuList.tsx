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

import {createElement, isValidElement, type Ref, useEffect, useRef} from 'react';
import {getInteractionModality} from '@react-aria/interactions';
import {mergeRefs} from '@react-aria/utils';
import {useVirtualizer} from '@tanstack/react-virtual';

const OPTION_HEIGHT = 36;
const GROUP_HEADER_HEIGHT = 32;
const MAX_MENU_HEIGHT = 300;
const MENU_PADDING = 4;

type GroupElementProps = {
  Heading: React.ComponentType<any>;
  children: React.ReactNode;
  cx: (...args: any[]) => string;
  getStyles: (...args: any[]) => unknown;
  headingProps: Record<string, unknown>;
  label: React.ReactNode;
  selectProps: unknown;
  theme: unknown;
};

type VirtualRow = {
  node: React.ReactNode;
  type: 'group' | 'option';
};

function flattenMenuChildren(children: React.ReactNode[]): VirtualRow[] {
  return children.flatMap(child => {
    if (!isValidElement<GroupElementProps>(child) || !child.props.Heading) {
      return [{node: child, type: 'option' as const}];
    }

    const {
      Heading,
      children: groupChildren,
      cx,
      getStyles,
      headingProps,
      label,
      selectProps,
      theme,
    } = child.props;

    const heading = createElement(
      Heading,
      {cx, getStyles, selectProps, theme, ...headingProps},
      label
    );
    const options = Array.isArray(groupChildren) ? groupChildren : [groupChildren];

    return [
      {node: heading, type: 'group' as const},
      ...options.map(node => ({node, type: 'option' as const})),
    ];
  });
}

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
  const rows = Array.isArray(children) ? flattenMenuChildren(children) : [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const combinedRef = mergeRefs(scrollRef, innerRef ?? null);
  const visibleOptionCount = Math.max(
    1,
    Math.floor((maxHeight - MENU_PADDING * 2) / optionHeight)
  );
  const alignedMaxHeight = visibleOptionCount * optionHeight + MENU_PADDING * 2;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: index =>
      rows[index]?.type === 'group' ? GROUP_HEADER_HEIGHT : optionHeight,
    overscan: 5,
    paddingStart: MENU_PADDING,
    paddingEnd: MENU_PADDING,
    scrollPaddingStart: MENU_PADDING,
    scrollPaddingEnd: MENU_PADDING,
  });

  const virtualItems = virtualizer.getVirtualItems();
  // react-select shares focused option identity with each Option child's data.
  // The focused DOM node may be virtualized out, so scroll by its child index.
  const focusedIndex = rows.findIndex(
    ({node}) =>
      isValidElement<{data?: unknown}>(node) && node.props.data === focusedOption
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
            {rows[virtualRow.index]?.node}
          </div>
        ))}
      </div>
    </div>
  );
}
