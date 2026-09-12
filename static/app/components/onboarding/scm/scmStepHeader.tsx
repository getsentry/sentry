import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

interface ScmStepHeaderProps {
  heading: string;
  subtitle: string;
}

export function ScmStepHeader({heading, subtitle}: ScmStepHeaderProps) {
  return (
    <Stack gap="md" width="100%" maxWidth={SCM_STEP_CONTENT_WIDTH} paddingBottom="xl">
      <Heading as="h2" size="3xl" align="center">
        {heading}
      </Heading>
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
    </Stack>
  );
}
