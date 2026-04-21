import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {HeadingSize, TextSize} from 'sentry/utils/theme';
import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

interface ScmStepHeaderProps {
  heading: string;
  subtitle: string;
  headingSize?: HeadingSize;
  subtitleSize?: TextSize;
}

export function ScmStepHeader({
  heading,
  subtitle,
  headingSize = '3xl',
  subtitleSize = 'lg',
}: ScmStepHeaderProps) {
  return (
    <Stack align="center" gap="sm" maxWidth={SCM_STEP_CONTENT_WIDTH}>
      <Heading as="h2" size={headingSize}>
        {heading}
      </Heading>
      <Text
        variant="muted"
        size={subtitleSize}
        wrap="pre-line"
        align="center"
        density="comfortable"
      >
        {subtitle}
      </Text>
    </Stack>
  );
}
