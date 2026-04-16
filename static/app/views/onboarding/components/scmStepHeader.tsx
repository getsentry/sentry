import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

interface ScmStepHeaderProps {
  heading: string;
  subtitle: string;
}

export function ScmStepHeader({heading, subtitle}: ScmStepHeaderProps) {
  return (
    <Stack align="center" gap="sm">
      <Heading as="h2" size="3xl">
        {heading}
      </Heading>
      <Text
        variant="muted"
        size="lg"
        wrap="pre-line"
        align="center"
        bold
        density="comfortable"
      >
        {subtitle}
      </Text>
    </Stack>
  );
}
