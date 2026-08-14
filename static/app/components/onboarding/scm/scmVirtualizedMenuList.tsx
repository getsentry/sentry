/**
 * Virtualized MenuList for the Select (react-select) component.
 * react-select re-renders every Option on hover/focus changes, which
 * causes ~1s lag with 130+ platform options containing PlatformIcon SVGs.
 * Virtualizing limits mounted components to the visible set.
 *
 * Supports grouped options: react-select renders each group as a single
 * <Group> element wrapping its Option children, which would virtualize as one
 * giant row. Groups are flattened here into heading + option rows instead,
 * with per-row measurement since headings and options differ in height.
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
const GROUP_HEADING_HEIGHT = 24;
const MAX_MENU_HEIGHT = 300;
const MENU_PADDING = 4;

/**
 * The props react-select's renderMenu passes to each Group element. Only
 * Group elements carry a Heading component, which is how they are told apart
 * from Option elements.
 */
interface GroupElementProps {
  Heading: React.ComponentType<any>;
  children: React.ReactNode;
  cx: unknown;
  getStyles: unknown;
  headingProps: Record<string, unknown>;
  label: React.ReactNode;
  selectProps: unknown;
  theme: unknown;
}

interface MenuRow {
  isHeading: boolean;
  key: React.Key;
  node: React.ReactNode;
  /** The react-select option data, used to locate the focused row. */
  data?: unknown;
}

function toOptionRow(node: React.ReactNode, fallbackKey: number): MenuRow {
  const element = isValidElement<{data?: unknown}>(node) ? node : null;
  return {
    isHeading: false,
    key: element?.key ?? fallbackKey,
    node,
    data: element?.props.data,
  };
}

function flattenMenuRows(children: React.ReactNode[]): MenuRow[] {
  const rows: MenuRow[] = [];
  for (const child of children) {
    if (!isValidElement<Partial<GroupElementProps>>(child) || !child.props.Heading) {
      rows.push(toOptionRow(child, rows.length));
      continue;
    }
    // Render the group's heading the same way react-select's Group does, so
    // the Select's groupHeading styles still apply.
    const {Heading, headingProps, label, selectProps, theme, getStyles, cx} = child.props;
    rows.push({
      isHeading: true,
      key: child.key ?? rows.length,
      node: (
        <Heading
          {...headingProps}
          selectProps={selectProps}
          theme={theme}
          getStyles={getStyles}
          cx={cx}
        >
          {label}
        </Heading>
      ),
    });
    const groupOptions = Array.isArray(child.props.children)
      ? child.props.children
      : [child.props.children];
    for (const option of groupOptions) {
      rows.push(toOptionRow(option, rows.length));
    }
  }
  return rows;
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
  const rows = Array.isArray(children) ? flattenMenuRows(children) : [];
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
    // Estimates only; rows are measured on mount below. Headings differ in
    // height from options, and an empty-label heading collapses to zero.
    estimateSize: index => (rows[index]?.isHeading ? GROUP_HEADING_HEIGHT : optionHeight),
    // Keep measurements attached to rows (not indices) when filtering shifts
    // the list.
    getItemKey: index => rows[index]?.key ?? index,
    overscan: 5,
    paddingStart: MENU_PADDING,
    paddingEnd: MENU_PADDING,
    scrollPaddingStart: MENU_PADDING,
    scrollPaddingEnd: MENU_PADDING,
  });

  const virtualItems = virtualizer.getVirtualItems();
  // react-select shares focused option identity with each Option child's data.
  // The focused DOM node may be virtualized out, so scroll by its row index.
  const focusedIndex = rows.findIndex(
    row => !row.isHeading && row.data === focusedOption
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
            ref={virtualizer.measureElement}
            data-index={virtualRow.index}
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
