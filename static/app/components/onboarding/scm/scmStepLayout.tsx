import type {ReactNode} from 'react';

import {Grid, Stack} from '@sentry/scraps/layout';

import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

interface ScmStepLayoutProps {
  children: ReactNode;
  /**
   * Supporting content beside the step. Given one, the step lays out
   * horizontally and the aside takes the right-hand column, collapsing under
   * the main column when there is no room for both.
   */
  aside?: ReactNode;
  /** Space between the step's own blocks. */
  gap?: React.ComponentProps<typeof Stack>['gap'];
}

/**
 * The column every SCM step's content sits in: capped, centered on the page,
 * and left-aligned inside. Pass `aside` to place supporting content beside the
 * step instead of below it.
 */
export function ScmStepLayout({children, aside, gap = '3xl'}: ScmStepLayoutProps) {
  const main = (
    <Stack gap={gap} width="100%" minWidth={0}>
      {children}
    </Stack>
  );

  return (
    <Stack align="center" width="100%">
      {aside ? (
        <Grid
          width="100%"
          maxWidth={SCM_STEP_CONTENT_WIDTH}
          columns={{zero: '1fr', '3xl': 'minmax(0, 1fr) minmax(0, 320px)'}}
          gap="3xl"
          align="center"
        >
          {main}
          {aside}
        </Grid>
      ) : (
        <Stack width="100%" maxWidth={SCM_STEP_CONTENT_WIDTH}>
          {main}
        </Stack>
      )}
    </Stack>
  );
}
