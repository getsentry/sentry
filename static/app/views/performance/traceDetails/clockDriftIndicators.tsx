import {Fragment, useLayoutEffect, useRef} from 'react';
import {IconClock} from '@sentry/icons/clock';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {formatTraceDuration} from 'sentry/utils/duration/formatTraceDuration';

import {formatClockDriftOffset} from './traceModels/clockDriftCorrection';
import type {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';

// These components take the correction values as props rather than the node: nodes are mutated in
// place when the correction is toggled, so the React Compiler would not see a change in the node.

/**
 * Explains the shift of a span in the waterfall. Wraps the elements that show the shift: the
 * duration label, and the ghost and connector of the selected span. Renders the element as is if
 * the span was not shifted.
 *
 * The element must be a DOM element, so the tooltip can attach to it without a wrapper that would
 * break its positioning.
 */
export function ClockDriftTooltip({
  children,
  offsetMs,
}: {
  children: React.ReactElement;
  offsetMs: number;
}) {
  if (offsetMs === 0) {
    return children;
  }

  return (
    <Tooltip
      title={t(
        'Shifted by %s to correct for clock drift',
        formatClockDriftOffset(offsetMs)
      )}
      skipWrapper
    >
      {children}
    </Tooltip>
  );
}

/**
 * Marks the duration label of the root of a subtree moved to correct for clock drift.
 */
export function ClockDriftLabelIcon({visible}: {visible: boolean}) {
  if (!visible) {
    return null;
  }

  return (
    <span className="TraceClockDriftIcon" data-test-id="trace-clock-drift-icon">
      <IconClock size="xs" />
    </span>
  );
}

/**
 * Shown next to the duration in the drawer of a shifted span, as the drawer shows the recorded
 * timestamps while the waterfall shows the shifted ones.
 */
export function ClockDriftTag({offsetMs}: {offsetMs: number}) {
  if (offsetMs === 0) {
    return null;
  }

  const distance = formatTraceDuration(Math.abs(offsetMs));
  const title =
    offsetMs > 0
      ? t(
          "Shown %s later in the waterfall to correct for clock drift: the clocks of the services in this trace were out of sync. The span's duration and the timestamps below are unchanged.",
          distance
        )
      : t(
          "Shown %s earlier in the waterfall to correct for clock drift: the clocks of the services in this trace were out of sync. The span's duration and the timestamps below are unchanged.",
          distance
        );

  return (
    <Tooltip title={title} skipWrapper>
      <Tag variant="muted" icon={<IconClock />}>
        {t('Shifted %s', formatClockDriftOffset(offsetMs))}
      </Tag>
    </Tooltip>
  );
}

/**
 * Shows where the selected span was recorded, before it was shifted to correct for clock drift. The
 * view manager positions the elements, like it does for span bars.
 *
 * Shown for every shifted span, not only the root of a moved subtree, so selecting a child shows
 * where it was recorded too. Only the selected span gets one, as all spans of a moved subtree are
 * shifted by the same offset, and a ghost on each would repeat the same arrow.
 */
export function ClockDriftGhost({
  manager,
  offsetMs,
  selected,
  space,
  virtualizedIndex,
}: {
  manager: VirtualizedViewManager;
  /**
   * The total offset the span was shifted by. This includes the shifts of all moved subtrees the
   * span is part of, so subtracting it from the span's space gives where it was recorded.
   */
  offsetMs: number;
  selected: boolean;
  space: [number, number];
  virtualizedIndex: number;
}) {
  const ghostRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<HTMLDivElement>(null);
  const visible = selected && offsetMs !== 0;

  useLayoutEffect(() => {
    if (!visible || !ghostRef.current || !connectorRef.current) {
      return;
    }
    manager.registerClockDriftGhost(
      {
        ghostRef: ghostRef.current,
        connectorRef: connectorRef.current,
        offsetMs,
        recorded: [space[0] - offsetMs, space[1]],
        space,
      },
      virtualizedIndex
    );
    return () => manager.registerClockDriftGhost(null, virtualizedIndex);
  }, [visible, manager, offsetMs, space, virtualizedIndex]);

  if (!visible) {
    return null;
  }

  return (
    <Fragment>
      <ClockDriftTooltip offsetMs={offsetMs}>
        <div
          ref={ghostRef}
          className="TraceClockDriftGhost"
          data-test-id="trace-clock-drift-ghost"
        />
      </ClockDriftTooltip>
      <ClockDriftTooltip offsetMs={offsetMs}>
        <div ref={connectorRef} className="TraceClockDriftConnector" />
      </ClockDriftTooltip>
    </Fragment>
  );
}
