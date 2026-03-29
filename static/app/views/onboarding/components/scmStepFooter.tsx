import {Flex} from '@sentry/scraps/layout';

import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

interface ScmStepFooterProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export function ScmStepFooter({
  children,
  maxWidth = SCM_STEP_CONTENT_WIDTH,
}: ScmStepFooterProps) {
  return (
    <Flex
      gap="lg"
      align="center"
      justify="end"
      width="100%"
      maxWidth={maxWidth}
      paddingTop="3xl"
    >
      {children}
    </Flex>
  );
}
