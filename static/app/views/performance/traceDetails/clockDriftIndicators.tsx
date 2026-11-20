import {IconClock} from '@sentry/icons/clock';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct} from 'sentry/locale';

import {
  formatClockDriftOffset,
  type ClockDriftCorrection,
} from './traceModels/clockDriftCorrection';

/**
 * The clock drift icon is part of the span's duration label. The label placement makes room for it,
 * so keep these in sync with the icon's styles.
 */
export const CLOCK_DRIFT_ICON_SIZE_PX = 12; // the `xs` icon size
export const CLOCK_DRIFT_ICON_GAP_PX = 4;

// These components take the correction values as props rather than the node: nodes are mutated in
// place when the correction is toggled, so the React Compiler would not see a change in the node.

function getShiftDescription(offsetMs: number, clientOp: string | undefined) {
  return tct(
    'Start and end shifted by [offset] to line up with the [op] span that made this request. The client and server clocks disagree.',
    {offset: formatClockDriftOffset(offsetMs), op: clientOp ?? t('client')}
  );
}

/**
 * Prefixes the duration label of a server span that was moved into the client span that made the
 * request. Only the root of the moved subtree gets one, its children moved along with it.
 */
export function ClockDriftLabelIcon({
  correction,
}: {
  correction: ClockDriftCorrection | null;
}) {
  if (!correction) {
    return null;
  }

  return (
    <Tooltip
      title={getShiftDescription(correction.offsetMs, correction.clientNode.op)}
      skipWrapper
    >
      <span className="TraceClockDriftIcon" data-test-id="trace-clock-drift-icon">
        <IconClock size="xs" />
      </span>
    </Tooltip>
  );
}

/**
 * Shown next to the duration in the drawer of a shifted span, as the drawer shows the recorded
 * timestamps while the waterfall shows the shifted ones.
 */
export function ClockDriftTag({
  offsetMs,
  clientOp,
}: {
  offsetMs: number;
  clientOp?: string;
}) {
  if (offsetMs === 0) {
    return null;
  }

  return (
    <Tooltip
      title={tct('[description] Timestamps here are as recorded.', {
        description: getShiftDescription(offsetMs, clientOp),
      })}
      skipWrapper
    >
      <Tag variant="muted" icon={<IconClock />}>
        {tct('Shifted [offset]', {offset: formatClockDriftOffset(offsetMs)})}
      </Tag>
    </Tooltip>
  );
}
