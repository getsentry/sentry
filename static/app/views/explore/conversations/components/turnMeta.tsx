import type {ReactNode} from 'react';

import {Flex} from '@sentry/scraps/layout';

/**
 * Fixed-width, right-aligned metric + duration columns, mirroring the spans
 * timeline. Space is reserved even when a value is absent so the columns line up
 * across message bubbles and tool-call rows.
 */
export function TurnMeta({metric, duration}: {duration: ReactNode; metric: ReactNode}) {
  if (!metric && !duration) {
    return null;
  }

  return (
    <Flex flexShrink={0} gap="md">
      <Flex width="12ch" justify="end">
        {metric}
      </Flex>
      <Flex width="8ch" justify="end">
        {duration}
      </Flex>
    </Flex>
  );
}
