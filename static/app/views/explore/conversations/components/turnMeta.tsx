import type {ReactNode} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

export const TURN_META_WIDTH = '140px';

/**
 * Fixed-width, right-aligned metric + duration, mirroring the spans timeline.
 * A dot separates the two when both are present. The block keeps a fixed width
 * so values line up across message bubbles and tool-call rows.
 */
export function TurnMeta({metric, duration}: {duration: ReactNode; metric: ReactNode}) {
  if (!metric && !duration) {
    return null;
  }

  return (
    <Flex flexShrink={0} width={TURN_META_WIDTH} align="center" justify="end" gap="xs">
      {metric}
      {metric && duration ? (
        <Text size="xs" variant="muted">
          •
        </Text>
      ) : null}
      {duration}
    </Flex>
  );
}
