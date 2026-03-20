import {useLayoutEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {SpaceSize} from 'sentry/utils/theme';
import {useDimensions} from 'sentry/utils/useDimensions';

import {LegendCheckbox} from './components/legendCheckbox';

export interface LegendItem {
  color: string;
  label: string;
  name: string;
}

interface ChartLegendProps {
  items: LegendItem[];
  onSelectionChange: (selected: Record<string, boolean>) => void;
  selected: Record<string, boolean>;
}

/**
 * Interactive chart legend with overflow handling.
 *
 * ## Layout
 *
 * All legend items are always rendered in the DOM. Items that overflow are
 * hidden with `visibility: hidden` so they still contribute to width
 * measurement. A `ResizeObserver` (via `useDimensions`) on the wrapper
 * re-measures whenever available space changes, and overflowed items are
 * shown in a dropdown trigger instead.
 *
 * The overflow trigger button is also always in the DOM — when there's no
 * overflow, it's positioned absolutely and hidden so it doesn't affect
 * layout but remains measurable via `getBoundingClientRect()`.
 *
 * ## Render flow
 *
 * 1. On mount (or when `wrapperWidth`/`items` change), `useLayoutEffect`
 *    runs before the browser paints. It reads the trigger's current width
 *    from its DOM ref, then walks children left-to-right, accumulating
 *    widths until one exceeds `wrapperWidth - reservedSpace`. This sets
 *    `firstOverflowIndex`.
 *
 * 2. The state change triggers a synchronous re-render (still before
 *    paint). The trigger text updates to reflect the actual overflow count
 *    (e.g. "+5 more"), and overflowed items become hidden. The effect does
 *    NOT re-run because `firstOverflowIndex` is excluded from its deps —
 *    only external inputs (resize, items) cause a re-computation.
 *
 * 3. A small `TRIGGER_WIDTH_BUFFER` is added to the measured trigger width
 *    to account for the text potentially getting wider after step 2 (e.g.
 *    "+9 more" → "+10 more" gains a digit).
 */
export function ChartLegend({items, selected, onSelectionChange}: ChartLegendProps) {
  const theme = useTheme();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const outerGap = parseInt(theme.space[OUTER_GAP], 10);
  const innerGap = parseInt(theme.space[INNER_GAP], 10);

  // ResizeObserver (via useDimensions) updates wrapperWidth on resize,
  // which triggers the useLayoutEffect below to recompute overflow.
  const {width: wrapperWidth} = useDimensions({elementRef: wrapperRef});
  const [firstOverflowIndex, setFirstOverflowIndex] = useState<number | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setFirstOverflowIndex(null);
      return;
    }

    const children = Array.from(container.children);

    // NOTE: Using `useDimensions` to track the trigger width introduces a
    // 1-render lag: both layout effects run in the same commit, but React queues
    // state updates from layout effects rather than applying them synchronously.
    // This effect would read the trigger width from the *previous* render, one
    // step behind. Reading from the ref directly avoids this. Add the buffer width
    // to avoid hide/show thrashing.
    const triggerWidth =
      (triggerRef.current?.getBoundingClientRect().width ?? 0) + TRIGGER_WIDTH_BUFFER;

    // Walk children left-to-right, accumulating width. At each step, if
    // there are remaining items, reserve space for the trigger button.
    let usedWidth = 0;
    let newOverflowIndex: number | null = null;

    for (let i = 0; i < children.length; i++) {
      if (i > 0) {
        usedWidth += innerGap;
      }
      usedWidth += children[i]!.getBoundingClientRect().width;

      const remainingItems = children.length - i - 1;
      const reservedSpace = remainingItems > 0 ? triggerWidth + outerGap : 0;

      if (usedWidth > wrapperWidth - reservedSpace) {
        newOverflowIndex = i;
        break;
      }
    }

    setFirstOverflowIndex(newOverflowIndex);
  }, [wrapperWidth, items, innerGap, outerGap]);

  const overflowItems =
    firstOverflowIndex === null ? [] : items.slice(firstOverflowIndex);

  const hasOverflow = overflowItems.length > 0;
  const overflowSet = new Set(overflowItems.map(item => item.name));

  const toggleItem = (name: string) => {
    onSelectionChange({
      ...selected,
      [name]: selected[name] === false ? true : false,
    });
  };

  const overflowOptions: Array<SelectOption<string>> = overflowItems.map(item => ({
    value: item.name,
    label: item.label,
    // Suppress the built-in checkmark; we render a custom LegendCheckbox via leadingItems
    hideCheck: true,
    leadingItems: renderLeadingCheckbox(item),
  }));

  const overflowValues = overflowItems
    .filter(item => selected[item.name] !== false)
    .map(item => item.name);

  const handleOverflowSelectChange = (options: Array<{value: string}>) => {
    const selectedSet = new Set(options.map(opt => opt.value));
    const newSelected = {...selected};
    for (const item of overflowItems) {
      newSelected[item.name] = selectedSet.has(item.name);
    }
    onSelectionChange(newSelected);
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <Flex
      ref={wrapperRef}
      align="center"
      gap={OUTER_GAP}
      wrap="nowrap"
      style={{height: theme.form.xs.height}}
    >
      <Flex
        ref={containerRef}
        align="center"
        gap={INNER_GAP}
        wrap="nowrap"
        data-test-id="legend-items"
        style={{overflow: 'hidden', minWidth: 0, flex: 1}}
      >
        {items.map(item => (
          <LegendItemButton
            key={item.name}
            align="center"
            gap="xs"
            flexShrink={0}
            style={{
              visibility: overflowSet.has(item.name) ? 'hidden' : 'visible',
            }}
            onClick={() => toggleItem(item.name)}
            role="button"
            aria-label={t('Toggle %s', item.label)}
          >
            <LegendCheckbox
              color={item.color}
              checked={selected[item.name] !== false}
              onChange={() => {}}
              aria-label={item.label}
            />

            <Text size="xs" ellipsis style={{maxWidth: MAX_LABEL_WIDTH}}>
              {item.label}
            </Text>
          </LegendItemButton>
        ))}
      </Flex>

      <CompactSelect
        multiple
        options={overflowOptions}
        value={overflowValues}
        onChange={handleOverflowSelectChange}
        position="bottom-end"
        size="xs"
        trigger={triggerProps => (
          <OverlayTrigger.Button
            {...triggerProps}
            ref={mergeRefs(triggerRef, triggerProps.ref)}
            size="xs"
            aria-hidden={hasOverflow ? undefined : true}
            tabIndex={hasOverflow ? undefined : -1}
            style={
              hasOverflow
                ? triggerProps.style
                : {...triggerProps.style, ...HIDDEN_TRIGGER_STYLE}
            }
          >
            {t('+%s more', Math.max(overflowItems.length, 1))}
          </OverlayTrigger.Button>
        )}
      />
    </Flex>
  );
}

/**
 * Renders a leading checkbox for a legend item inside the overflow dropdown.
 * Stateless — only depends on its arguments, so it lives outside the component.
 */
function renderLeadingCheckbox(item: LegendItem) {
  return function LeadingCheckbox({isSelected}: {isSelected: boolean}) {
    return (
      <LegendCheckbox
        color={item.color}
        checked={isSelected}
        onChange={() => {}}
        aria-label={item.label}
      />
    );
  };
}

// Gap between the items container and the overflow trigger
const OUTER_GAP: SpaceSize = 'xs';

// Gap between individual legend items inside the container
const INNER_GAP: SpaceSize = 'md';

const MAX_LABEL_WIDTH = 180;

/**
 * Extra pixels added to the measured trigger width to account for the text
 * changing after the effect runs. The effect measures the trigger while it
 * still shows its pre-update text (e.g. "+1 more"), but after re-render the
 * text may be wider (e.g. "+10 more"). This buffer covers the width of an
 * extra digit so the reserved space is always sufficient.
 */
const TRIGGER_WIDTH_BUFFER = 10;

const HIDDEN_TRIGGER_STYLE: React.CSSProperties = {
  visibility: 'hidden',
  position: 'absolute',
  pointerEvents: 'none',
};

const LegendItemButton = styled(Flex)`
  cursor: pointer;
  white-space: nowrap;
  user-select: none;

  &:hover {
    opacity: 0.8;
  }
`;
