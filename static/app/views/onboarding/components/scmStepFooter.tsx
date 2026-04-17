import {Flex} from '@sentry/scraps/layout';

import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

interface ScmStepFooterProps {
  children: React.ReactNode;
  leading?: React.ReactNode;
  maxWidth?: string;
}

export function ScmStepFooter({
  children,
  leading,
  maxWidth = SCM_STEP_CONTENT_WIDTH,
}: ScmStepFooterProps) {
  return (
    <Flex
      gap="lg"
      align="center"
      justify={leading ? 'between' : 'end'}
      width="100%"
      maxWidth={maxWidth}
      paddingTop="3xl"
    >
      {leading}
      <Flex gap="lg" align="center">
        {children}
      </Flex>
    </Flex>
  );
}
