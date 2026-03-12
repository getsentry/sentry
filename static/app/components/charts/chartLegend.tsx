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

/** Gap between the items container and the overflow trigger. */
const OUTER_GAP: SpaceSize = 'xs';

/** Gap between individual legend items inside the container. */
const INNER_GAP: SpaceSize = 'md';

const MAX_LABEL_WIDTH = 180;

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

/**
 * Interactive chart legend with overflow handling.
 *
 * All items are always rendered in the DOM, but items that don't fit are
 * hidden with `visibility: hidden` so they still contribute to width
 * measurement. A `ResizeObserver` on the wrapper re-measures whenever the
 * available space changes, and items that overflow are shown in a dropdown
 * instead.
 */
export function ChartLegend({items, selected, onSelectionChange}: ChartLegendProps) {
  const theme = useTheme();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const outerGap = parseInt(theme.space[OUTER_GAP], 10);
  const innerGap = parseInt(theme.space[INNER_GAP], 10);

  // useDimensions handles ResizeObserver internally — when the wrapper
  // resizes, this value updates and the useLayoutEffect below recomputes.
  const {width: wrapperWidth} = useDimensions({elementRef: wrapperRef});

  // Measured after DOM commit so we read the actual (not stale) children.
  const [firstOverflowIndex, setFirstOverflowIndex] = useState<number | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setFirstOverflowIndex(null);
      return;
    }

    // Read trigger width directly from the DOM ref instead of from React state.
    //
    // Reading from state (via useDimensions) introduced a 1-render lag: the
    // useDimensions layout effect and this effect run in the same commit, but
    // React queues state updates from layout effects rather than applying them
    // immediately. This effect would therefore read the triggerWidth from the
    // *previous* render — one step behind — causing the trigger to oscillate
    // between shown and hidden when items are near the overflow boundary.
    //
    // React guarantees that refs are attached before layout effects run, so
    // reading from the ref here always reflects the current DOM state.
    const triggerWidth = triggerRef.current?.getBoundingClientRect().width ?? 0;

    const children = Array.from(container.children);
    let usedWidth = 0;
    let index: number | null = null;

    for (let i = 0; i < children.length; i++) {
      const childWidth = children[i]!.getBoundingClientRect().width;
      if (i > 0) {
        usedWidth += innerGap;
      }
      usedWidth += childWidth;

      // Reserve space for the trigger + the gap between wrapper children
      const remainingItems = children.length - i - 1;
      const reservedSpace = remainingItems > 0 ? triggerWidth + outerGap : 0;

      if (usedWidth > wrapperWidth - reservedSpace) {
        index = i;
        break;
      }
    }

    setFirstOverflowIndex(index);
    // `firstOverflowIndex` is included as a dep so this effect re-runs whenever
    // the trigger appears or disappears (changing what triggerRef.current points
    // to), allowing the effect to verify and stabilize the new state.
  }, [wrapperWidth, firstOverflowIndex, items, innerGap, outerGap]);

  const overflowItems =
    firstOverflowIndex === null ? [] : items.slice(firstOverflowIndex);

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

      {overflowItems.length > 0 && (
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
            >
              {t('+%s more', overflowItems.length)}
            </OverlayTrigger.Button>
          )}
        />
      )}
    </Flex>
  );
}

const LegendItemButton = styled(Flex)`
  cursor: pointer;
  white-space: nowrap;
  user-select: none;

  &:hover {
    opacity: 0.8;
  }
`;
