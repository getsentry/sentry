import {motion} from 'framer-motion';

import {Container, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ONBOARDING_ENTER, ONBOARDING_STAGGER} from 'sentry/views/onboarding/animations';
import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

interface ScmStepHeaderProps {
  heading: string;
  subtitle: string;
}

/**
 * The block itself holds still; the title and subtitle each enter on their own
 * so the heading reads as settling into place rather than sliding up.
 */
export function ScmStepHeader({heading, subtitle}: ScmStepHeaderProps) {
  return (
    <MotionStack
      gap="md"
      width="100%"
      maxWidth={SCM_STEP_CONTENT_WIDTH}
      paddingBottom="2xl"
      {...ONBOARDING_STAGGER}
    >
      <MotionContainer {...ONBOARDING_ENTER}>
        <Heading as="h2" size="3xl" align="center">
          {heading}
        </Heading>
      </MotionContainer>
      <MotionContainer {...ONBOARDING_ENTER}>
        <Text
          align="center"
          variant="muted"
          size="lg"
          wrap="pre-line"
          density="comfortable"
          textWrap="pretty"
        >
          {subtitle}
        </Text>
      </MotionContainer>
    </MotionStack>
  );
}

const MotionStack = motion.create(Stack);
const MotionContainer = motion.create(Container);
