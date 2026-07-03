import type {ReactNode} from 'react';

import {Grid} from '@sentry/scraps/layout';

/**
 * Fixed-width, right-aligned metric + duration columns, mirroring the spans
 * timeline. Space is reserved even when a value is absent so the columns line up
 * across message bubbles and tool-call rows.
 */
export function TurnMeta({metric, duration}: {duration: ReactNode; metric: ReactNode}) {
  return (
    <Grid flexShrink={0} columns="100px 56px" gap="md" justifyItems="end">
      {metric}
      {duration}
    </Grid>
  );
}
