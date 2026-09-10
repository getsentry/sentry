import {Tag} from '@sentry/scraps/badge';
import {CodeBlock} from '@sentry/scraps/code';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {List} from 'sentry/components/list';
import {ListItem} from 'sentry/components/list/listItem';
import {IconBot} from 'sentry/icons';
import {t} from 'sentry/locale';
import {AgentInfo} from 'sentry/views/onboarding/components/agentInfo';
import {SETUP_CARD_ICON_SIZE, SETUP_CARD_MARKER_PX} from 'sentry/views/onboarding/consts';

export type AgentSetupCopySource = 'install_command' | 'prompt';

const INSTALL_PLUGIN_COMMAND = 'npx @sentry/agent-plugin install';

const SUPPORTED_AGENTS = ['Claude Code', 'Codex', 'Cursor', 'Grok'];
const SUPPORTED_AGENTS_LABEL = t(
  '%s & %s',
  SUPPORTED_AGENTS.slice(0, -1).join(', '),
  SUPPORTED_AGENTS.at(-1)
);

interface AgentSetupCardProps {
  onCopyCommand: (source: AgentSetupCopySource) => void;
  prompt: string;
  hasSetupFailed?: boolean;
  onboardingCode?: string;
}

export function AgentSetupCard({
  hasSetupFailed,
  onboardingCode,
  onCopyCommand,
  prompt,
}: AgentSetupCardProps) {
  return (
    <Stack border="primary" radius="xl" padding="xl" gap="0">
      <Flex align="center" gap="md">
        <Flex width={SETUP_CARD_MARKER_PX} flexShrink={0} justify="center">
          <IconBot size={SETUP_CARD_ICON_SIZE} variant="secondary" />
        </Flex>
        <Flex align="center" gap="md" wrap="wrap">
          <Heading as="h3" size="lg">
            {t('Set up with your coding agent')}
          </Heading>
          <Tag variant="info">{t('Recommended')}</Tag>
        </Flex>
      </Flex>

      <Flex gap="md" paddingTop="md" paddingBottom="2xl">
        <Container width={SETUP_CARD_MARKER_PX} flexShrink={0} />
        <Stack gap="xs">
          <Flex align="center" gap="xs" wrap="wrap">
            <Text variant="muted" size="md">
              {t('Works with')}
            </Text>
            <Text size="md">{SUPPORTED_AGENTS_LABEL}</Text>
          </Flex>
          <Flex>
            <AgentInfo onboardingCode={onboardingCode} />
          </Flex>
        </Stack>
      </Flex>

      <List symbol="colored-numeric">
        <ListItem>
          <Stack gap="lg" paddingTop="xs" paddingBottom="2xl">
            <Text size="md">{t('Install the Sentry plugin for your agent')}</Text>
            <CodeBlock
              dark
              alwaysShowCopyButton
              onCopy={() => onCopyCommand('install_command')}
              wrapMode="wrap"
            >
              {INSTALL_PLUGIN_COMMAND}
            </CodeBlock>
          </Stack>
          <Flex
            position="absolute"
            top={SETUP_CARD_MARKER_PX}
            bottom="0"
            left="0"
            width={SETUP_CARD_MARKER_PX}
            paddingTop="xs"
            justify="center"
          >
            <Separator orientation="vertical" border="muted" />
          </Flex>
        </ListItem>
        <ListItem>
          <Stack gap="lg" paddingTop="xs">
            <Stack gap="xs">
              <Text size="md">{t('Ask your agent to set up Sentry')}</Text>
              <Text variant="muted" size="md">
                {t('Point it to your project folder and paste this.')}
              </Text>
            </Stack>
            <CodeBlock
              dark
              alwaysShowCopyButton={!hasSetupFailed}
              hideCopyButton={hasSetupFailed}
              onCopy={() => onCopyCommand('prompt')}
              wrapMode="wrap"
            >
              {prompt}
            </CodeBlock>
          </Stack>
        </ListItem>
      </List>
    </Stack>
  );
}
