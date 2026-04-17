import type {ComponentProps} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

interface ScmStepHeaderProps {
  heading: string;
  subtitle: string;
  headingSize?: ComponentProps<typeof Heading>['size'];
  subtitleSize?: ComponentProps<typeof Text>['size'];
}

export function ScmStepHeader({
  heading,
  subtitle,
  headingSize = '3xl',
  subtitleSize = 'lg',
}: ScmStepHeaderProps) {
  return (
    <Stack align="center" gap="sm">
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
