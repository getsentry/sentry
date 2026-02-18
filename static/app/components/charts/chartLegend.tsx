import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {scheduleMicroTask} from 'sentry/utils/scheduleMicroTask';

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
 * All items are always rendered in the DOM, but items that don't fit are
 * hidden with `visibility: hidden` so they still contribute to width
 * measurement. A `ResizeObserver` on the container (and on the overflow
 * trigger) re-measures whenever the available space changes, and items that
 * overflow are shown in a dropdown instead.
 */
export function ChartLegend({items, selected, onSelectionChange}: ChartLegendProps) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [firstOverflowIndex, setFirstOverflowIndex] = useState<number | null>(null);
  const outerGap = parseInt(theme.space.xs, 10);
  const innerGap = parseInt(theme.space.md, 10);

  const computeOverflowIndex = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const containerWidth = container.offsetWidth;
    const triggerWidth = triggerRef.current?.offsetWidth ?? 0;

    const children = Array.from(container.children);
    let usedWidth = 0;
    let newFirstOverflowIndex: number | null = null;

    for (let i = 0; i < children.length; i++) {
      const childWidth = children[i]!.getBoundingClientRect().width;
      if (i > 0) {
        usedWidth += innerGap;
      }
      usedWidth += childWidth;

      // Reserve space for the trigger + the gap between container and trigger
      const remainingItems = children.length - i - 1;
      const reservedSpace = remainingItems > 0 ? triggerWidth + outerGap : 0;

      if (usedWidth > containerWidth - reservedSpace) {
        newFirstOverflowIndex = i;
        break;
      }
    }

    setFirstOverflowIndex(newFirstOverflowIndex);
  }, [outerGap, innerGap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return () => {};
    }

    computeOverflowIndex();

    // Re-compute when the container resizes. ResizeObserver callbacks are
    // already coalesced per-frame by the spec, but we defer measurement to a
    // microtask as a precaution against forced reflows if the resulting
    // state update synchronously changes layout.
    const resizeObserver = new ResizeObserver(() => {
      scheduleMicroTask(computeOverflowIndex);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [computeOverflowIndex, items.length]);

  const hasTrigger = firstOverflowIndex !== null;

  // Re-compute when the trigger appears or resizes
  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return () => {};
    }

    const resizeObserver = new ResizeObserver(() => {
      scheduleMicroTask(computeOverflowIndex);
    });
    resizeObserver.observe(trigger);

    return () => {
      resizeObserver.disconnect();
    };
  }, [computeOverflowIndex, hasTrigger]);

  const overflowItems = useMemo(
    () => (firstOverflowIndex === null ? [] : items.slice(firstOverflowIndex)),
    [firstOverflowIndex, items]
  );

  // Pre-computed set for O(1) lookups when deciding visibility of each item.
  // Items that overflow are kept in the DOM (with visibility: hidden) so they
  // still contribute to width measurement.
  const overflowSet = useMemo(
    () => new Set(overflowItems.map(item => item.name)),
    [overflowItems]
  );

  const toggleItem = useCallback(
    (name: string) => {
      onSelectionChange({
        ...selected,
        [name]: selected[name] === false ? true : false,
      });
    },
    [selected, onSelectionChange]
  );

  const renderLeadingCheckbox = useCallback(
    (item: LegendItem) =>
      function ({isSelected}: {isSelected: boolean}) {
        return (
          <LegendCheckbox
            color={item.color}
            checked={isSelected}
            onChange={() => {}}
            aria-label={item.label}
          />
        );
      },
    []
  );

  const overflowOptions: Array<SelectOption<string>> = useMemo(
    () =>
      overflowItems.map(item => ({
        value: item.name,
        label: item.label,
        // Suppress the built-in checkmark; we render a custom LegendCheckbox via leadingItems
        hideCheck: true,
        leadingItems: renderLeadingCheckbox(item),
      })),
    [overflowItems, renderLeadingCheckbox]
  );

  const overflowValues = useMemo(
    () =>
      overflowItems.filter(item => selected[item.name] !== false).map(item => item.name),
    [overflowItems, selected]
  );

  const handleOverflowSelectChange = useCallback(
    (options: Array<{value: string}>) => {
      const selectedSet = new Set(options.map(opt => opt.value));
      const newSelected = {...selected};
      for (const item of overflowItems) {
        newSelected[item.name] = selectedSet.has(item.name);
      }
      onSelectionChange(newSelected);
    },
    [selected, overflowItems, onSelectionChange]
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <Flex align="center" gap="xs" wrap="nowrap">
      <Flex
        ref={containerRef}
        align="center"
        gap="md"
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
              onChange={e => {
                e.stopPropagation();
                toggleItem(item.name);
              }}
              aria-label={item.label}
            />

            <Text size="xs" ellipsis>
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
            <OverflowTrigger ref={triggerRef} {...triggerProps}>
              {t('%s more', overflowItems.length)}
            </OverflowTrigger>
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

const OverflowTrigger = styled(OverlayTrigger.Button)`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  background: none;
  border: none;
  border-radius: ${p => p.theme.radius.sm};
  padding: 2px ${p => p.theme.space.sm};
  font-size: ${p => p.theme.font.size.sm};
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
`;
