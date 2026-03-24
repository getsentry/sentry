import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconCommit, IconGeneric, IconJson, IconTag} from 'sentry/icons';
import {t} from 'sentry/locale';

const BENEFITS = [
  {
    icon: IconGeneric,
    title: t('Automatic SDK selection'),
    description: t("We'll detect your tech stack and recommend the best SDK"),
  },
  {
    icon: IconTag,
    title: t('Release Tracking'),
    description: t('Associate errors with specific releases and commits'),
  },
  {
    icon: IconJson,
    title: t('Source Maps'),
    description: t(
      'Automatically upload source maps on deploy for readable stack traces'
    ),
  },
  {
    icon: IconCommit,
    title: t('Suspect Commits'),
    description: t('Identify the exact commit that likely introduced an error'),
  },
] as const;

interface ScmBenefitsCardProps {
  showTitle?: boolean;
}

export function ScmBenefitsCard({showTitle}: ScmBenefitsCardProps) {
  return (
    <Container border="secondary" padding="xl" radius="md">
      <Stack gap="2xl">
        {showTitle && (
          <Text variant="muted" size="md" bold density="comfortable">
            {t('Why connect your repository?')}
          </Text>
        )}
        {BENEFITS.map(({icon: Icon, title, description}) => (
          <Flex key={title} gap="lg" align="start">
            <Icon legacySize="20px" variant="muted" />
            <Stack gap="2xs">
              <Text bold size="md" density="comfortable">
                {title}
              </Text>
              <Text variant="muted" size="md" density="comfortable">
                {description}
              </Text>
            </Stack>
          </Flex>
        ))}
      </Stack>
    </Container>
  );
}
