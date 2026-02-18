import {useCallback, useEffect, useState} from 'react';

import {scheduleMicroTask} from 'sentry/utils/scheduleMicroTask';

/**
 * A generic hook that detects which items overflow a container by comparing
 * child element widths against the available container width.
 *
 * The caller renders ALL items as children of the container referenced by
 * `containerRef`. Overflow items should be hidden with `visibility: hidden`
 * so they still contribute to measurement.
 *
 * A `ResizeObserver` watches the container so the partition updates when the
 * container is resized. If a `triggerRef` is provided, its width (plus `gap`)
 * is subtracted from the available space so the overflow trigger always fits.
 *
 * Returns `{ visibleItems, overflowItems }` as a partition of the input items.
 */
export function useOverflowItems<T>(
  containerRef: React.RefObject<HTMLElement | null>,
  items: T[],
  options?: {
    gap?: number;
    triggerRef?: React.RefObject<HTMLElement | null>;
  }
): {
  overflowItems: T[];
  visibleItems: T[];
} {
  const [firstOverflowIndex, setFirstOverflowIndex] = useState<number | null>(null);
  const triggerRef = options?.triggerRef;
  const gap = options?.gap ?? 0;

  const computeOverflow = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const containerWidth = container.offsetWidth;
    const triggerWidth = triggerRef?.current?.offsetWidth ?? 0;
    const containerGap = parseFloat(getComputedStyle(container).columnGap) || 0;

    const children = Array.from(container.children);
    let usedWidth = 0;
    let newFirstOverflowIndex: number | null = null;

    for (let i = 0; i < children.length; i++) {
      const childWidth = children[i]!.getBoundingClientRect().width;
      if (i > 0) {
        usedWidth += containerGap;
      }
      usedWidth += childWidth;

      // Reserve space for the trigger + the gap between container and trigger
      const remainingItems = children.length - i - 1;
      const reservedSpace = remainingItems > 0 ? triggerWidth + gap : 0;

      if (usedWidth > containerWidth - reservedSpace) {
        newFirstOverflowIndex = i;
        break;
      }
    }

    setFirstOverflowIndex(newFirstOverflowIndex);
  }, [containerRef, triggerRef, gap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return () => {};
    }

    // Initial computation
    computeOverflow();

    // Re-compute when the container resizes. ResizeObserver callbacks are
    // already coalesced per-frame by the spec, but we defer measurement to a
    // microtask as a precaution against forced reflows if the resulting
    // state update synchronously changes layout.
    const resizeObserver = new ResizeObserver(() => {
      scheduleMicroTask(computeOverflow);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, computeOverflow, items.length]);

  // Also re-compute when the trigger appears or resizes
  useEffect(() => {
    const trigger = triggerRef?.current;
    if (!trigger) {
      return () => {};
    }

    const resizeObserver = new ResizeObserver(() => {
      scheduleMicroTask(computeOverflow);
    });
    resizeObserver.observe(trigger);

    return () => {
      resizeObserver.disconnect();
    };
  }, [triggerRef, computeOverflow, firstOverflowIndex !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (firstOverflowIndex === null) {
    return {visibleItems: items, overflowItems: []};
  }

  return {
    visibleItems: items.slice(0, firstOverflowIndex),
    overflowItems: items.slice(firstOverflowIndex),
  };
}
