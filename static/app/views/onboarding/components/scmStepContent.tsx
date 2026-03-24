import {Stack} from '@sentry/scraps/layout';

import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

interface ScmStepContentProps {
  children: React.ReactNode;
}

export function ScmStepContent({children}: ScmStepContentProps) {
  return (
    <Stack gap="lg" width="100%" maxWidth={SCM_STEP_CONTENT_WIDTH}>
      {children}
    </Stack>
  );
}
