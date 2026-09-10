import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

interface ScmStepHeaderProps {
  heading: string;
  subtitle: string;
}

export function ScmStepHeader({heading, subtitle}: ScmStepHeaderProps) {
  return (
    <Stack gap="md" maxWidth={SCM_STEP_CONTENT_WIDTH}>
      <Heading as="h2" size="4xl">
        {heading}
      </Heading>
      <Text
        variant="muted"
        size="xl"
        wrap="pre-line"
        density="comfortable"
        textWrap="pretty"
      >
        {subtitle}
      </Text>
    </Stack>
  );
}
