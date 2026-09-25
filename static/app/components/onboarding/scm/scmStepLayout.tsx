import type {ReactNode} from 'react';

import {Stack} from '@sentry/scraps/layout';

import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

interface ScmStepLayoutProps {
  children: ReactNode;
  /** Space between the step's own blocks. */
  gap?: React.ComponentProps<typeof Stack>['gap'];
}

/**
 * The column every SCM step's content sits in: capped, centered on the page,
 * and left-aligned inside.
 */
export function ScmStepLayout({children, gap = '3xl'}: ScmStepLayoutProps) {
  return (
    <Stack align="center" width="100%">
      <Stack width="100%" maxWidth={SCM_STEP_CONTENT_WIDTH}>
        <Stack gap={gap} width="100%" minWidth={0}>
          {children}
        </Stack>
      </Stack>
    </Stack>
  );
}
