import {IconClock} from '@sentry/icons/clock';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {formatTraceDuration} from 'sentry/utils/duration/formatTraceDuration';

import {formatClockDriftOffset} from './traceModels/clockDriftCorrection';

// These components take the correction values as props rather than the node: nodes are mutated in
// place when the correction is toggled, so the React Compiler would not see a change in the node.

/**
 * Explains the shift of a span in the waterfall. Wraps the duration label of the span. Renders the
 * element as is if the span was not shifted.
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
 * Prefixes the duration label of a server span that was moved into the client span that made the
 * request. Only the root of the moved subtree gets one, its children moved along with it. The
 * label's tooltip explains it.
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
