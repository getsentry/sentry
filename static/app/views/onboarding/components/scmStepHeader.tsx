import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

interface ScmStepHeaderProps {
  heading: string;
  stepNumber: number;
  subtitle: string;
  tag?: string;
  totalSteps?: number;
}

export function ScmStepHeader({
  stepNumber,
  totalSteps = 3,
  heading,
  subtitle,
  tag,
}: ScmStepHeaderProps) {
  return (
    <Stack align="center" gap="md">
      <Flex align="center" gap="lg">
        <Text variant="muted" size="lg" bold density="comfortable">
          {t('Step %s of %s', stepNumber, totalSteps)}
        </Text>
        {tag && <Tag variant="muted">{tag}</Tag>}
      </Flex>
      <Stack align="center" gap="sm">
        <Heading as="h2" size="3xl">
          {heading}
        </Heading>
        <Text variant="muted" size="lg" bold density="comfortable" align="center">
          {subtitle}
        </Text>
      </Stack>
    </Stack>
  );
}
