import type {ReactNode} from 'react';

import {getDuration} from '@sentry/scraps/duration';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

/** Width of each of the meta block's two columns: the metric and the duration. */
const TURN_META_COLUMN_WIDTH = '76px';

export const TURN_META_WIDTH = '160px';

interface TurnMetaProps {
  /** Formatted with `getDuration`. Missing or non-positive values aren't shown. */
  duration?: number;
  /** A metric shown before the duration, such as a cost or size. */
  metric?: ReactNode;
  /** Colors both values, e.g. `danger` for a span that errored. */
  variant?: 'muted' | 'primary' | 'danger';
}

/**
 * Fixed-width, right-aligned metric and duration columns, shared by the
 * transcript and the Agent Timeline. Both columns keep a fixed width, so values
 * line up across message bubbles, tool-call rows and timeline rows.
 */
export function TurnMeta({metric, duration, variant = 'muted'}: TurnMetaProps) {
  const hasDuration = duration !== undefined && duration > 0;
  if (!metric && !hasDuration) {
    return null;
  }

  return (
    <Flex flexShrink={0} width={TURN_META_WIDTH} align="center" justify="end" gap="sm">
      <Flex width={TURN_META_COLUMN_WIDTH} justify="end" minWidth={0}>
        {metric ? (
          <Text size="sm" variant={variant} tabular align="right" ellipsis>
            {metric}
          </Text>
        ) : null}
      </Flex>
      <Flex width={TURN_META_COLUMN_WIDTH} justify="end" minWidth={0}>
        {hasDuration ? (
          <Text size="sm" variant={variant} tabular align="right" ellipsis>
            {getDuration(duration, {precision: 2, style: 'short'})}
          </Text>
        ) : null}
      </Flex>
    </Flex>
  );
}
