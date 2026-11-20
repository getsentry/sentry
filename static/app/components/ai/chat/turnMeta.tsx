import type {ReactNode} from 'react';

import {getDuration} from '@sentry/scraps/duration';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

export const TURN_META_WIDTH = '140px';

interface TurnMetaProps {
  /** Formatted with `getDuration`. Missing or non-positive values aren't shown. */
  duration?: number;
  /** A metric shown before the duration, such as a cost or size. */
  metric?: ReactNode;
}

/**
 * Fixed-width, right-aligned metric + duration, mirroring the spans timeline.
 * A dot separates the two when both are present. The block keeps a fixed width
 * so values line up across message bubbles and tool-call rows.
 */
export function TurnMeta({metric, duration}: TurnMetaProps) {
  const hasDuration = duration !== undefined && duration > 0;
  if (!metric && !hasDuration) {
    return null;
  }

  return (
    <Flex flexShrink={0} width={TURN_META_WIDTH} align="center" justify="end" gap="xs">
      {metric}
      {metric && hasDuration ? (
        <Text size="xs" variant="muted">
          •
        </Text>
      ) : null}
      {hasDuration ? (
        <TurnMetaValue>
          {getDuration(duration, {precision: 2, style: 'short'})}
        </TurnMetaValue>
      ) : null}
    </Flex>
  );
}

/** A value in the meta column, styled like the duration next to it. */
export function TurnMetaValue({children}: {children: ReactNode}) {
  return (
    <Text size="xs" variant="muted" tabular align="right">
      {children}
    </Text>
  );
}
