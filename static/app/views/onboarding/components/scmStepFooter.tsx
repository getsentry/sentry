import {Flex} from '@sentry/scraps/layout';

import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

interface ScmStepFooterProps {
  children: React.ReactNode;
}

export function ScmStepFooter({children}: ScmStepFooterProps) {
  return (
    <Flex
      gap="lg"
      align="center"
      justify="end"
      width="100%"
      maxWidth={SCM_STEP_CONTENT_WIDTH}
      paddingTop="3xl"
    >
      {children}
    </Flex>
  );
}
