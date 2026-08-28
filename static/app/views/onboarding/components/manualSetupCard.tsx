import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconBranch, IconCheckmark, IconCode, IconGlobe, IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';

interface ManualSetupCardProps {
  isAgentConnected: boolean;
  onSetupInBrowser: () => void;
}

export function ManualSetupCard({
  isAgentConnected,
  onSetupInBrowser,
}: ManualSetupCardProps) {
  return (
    <Stack
      align="start"
      alignSelf="start"
      gap="xl"
      width="100%"
      border="muted"
      radius="lg"
      padding="xl"
    >
      <Flex align="center" gap="sm">
        <IconGlobe size="md" variant="secondary" />
        <Text variant="muted" size="sm" bold uppercase>
          {t('Manual')}
        </Text>
      </Flex>

      <Stack gap="md">
        <Heading as="h3" size="lg">
          {t('Set up in browser')}
        </Heading>
        <Text variant="muted" size="md" density="comfortable" textWrap="pretty">
          {t("Configure your application the ol'fashioned way.")}
        </Text>
      </Stack>

      <Stack gap="lg" width="100%">
        <Stack.Separator border="muted" />
        <ManualSetupStep
          icon={<IconBranch size="xs" variant="secondary" />}
          title={t('Connect your repository')}
          description={t('GitHub, GitLab, Bitbucket and more')}
        />
        <Stack.Separator border="muted" />
        <ManualSetupStep
          icon={<IconStack size="xs" variant="secondary" />}
          title={t('Choose your platform')}
          description={t("We'll detect your framework")}
        />
        <Stack.Separator border="muted" />
        <ManualSetupStep
          icon={<IconCode size="xs" variant="secondary" />}
          title={t('Install the SDK')}
          description={t('Add our code snippet to your project')}
        />
        <Stack.Separator border="muted" />
        <ManualSetupStep
          icon={<IconCheckmark size="xs" variant="secondary" />}
          title={t('Verify your setup')}
          description={t('Send a test event to confirm it all works')}
        />
      </Stack>

      <Button
        variant={isAgentConnected ? undefined : 'primary'}
        onClick={onSetupInBrowser}
        data-test-id="onboarding-setup-in-browser"
      >
        {isAgentConnected ? t('Switch to Manual') : t('Start setup')}
      </Button>
    </Stack>
  );
}

function ManualSetupStep({
  description,
  icon,
  title,
}: {
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Flex align="start" gap="md">
      <Flex flexShrink={0} paddingTop="2xs">
        {icon}
      </Flex>
      <Stack gap="xs">
        <Text size="sm" bold>
          {title}
        </Text>
        <Text size="sm" variant="muted">
          {description}
        </Text>
      </Stack>
    </Flex>
  );
}
