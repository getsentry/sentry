import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {CodeBlock} from '@sentry/scraps/code';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {IconBot} from 'sentry/icons';
import {t} from 'sentry/locale';
import {AgentInfo} from 'sentry/views/onboarding/components/agentInfo';
import {SETUP_CARD_ICON_PX, SETUP_CARD_ICON_SIZE} from 'sentry/views/onboarding/consts';

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
    <Stack border="primary" radius="xl" padding="xl 2xl" gap="0">
      <Flex align="center" gap="xl">
        <Flex width={SETUP_CARD_ICON_PX} flexShrink={0} justify="center">
          <IconBot size={SETUP_CARD_ICON_SIZE} variant="secondary" />
        </Flex>
        <Flex align="center" gap="md" wrap="wrap">
          <Heading as="h3" size="lg">
            {t('Set up with your coding agent')}
          </Heading>
          <Tag variant="info">{t('Recommended')}</Tag>
        </Flex>
      </Flex>

      <Flex gap="xl" paddingTop="md" paddingBottom="2xl">
        <Container width={SETUP_CARD_ICON_PX} flexShrink={0} />
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

      <Flex align="center" gap="xl">
        <Flex width={SETUP_CARD_ICON_PX} flexShrink={0} justify="center">
          <StepNumber>1</StepNumber>
        </Flex>
        <Text size="md">{t('Install the Sentry plugin for your agent')}</Text>
      </Flex>

      <Flex gap="xl">
        <Flex width={SETUP_CARD_ICON_PX} flexShrink={0} justify="center" paddingTop="md">
          <Separator orientation="vertical" border="muted" />
        </Flex>
        <Container flexGrow={1} minWidth="0px" paddingTop="lg" paddingBottom="2xl">
          <CodeBlock
            dark
            alwaysShowCopyButton
            onCopy={() => onCopyCommand('install_command')}
            wrapMode="wrap"
          >
            {INSTALL_PLUGIN_COMMAND}
          </CodeBlock>
        </Container>
      </Flex>

      <Flex gap="xl" paddingTop="md">
        <Flex width={SETUP_CARD_ICON_PX} flexShrink={0} justify="center">
          <StepNumber>2</StepNumber>
        </Flex>
        <Stack width="100%" gap="lg">
          <Stack gap="sm">
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
      </Flex>
    </Stack>
  );
}

const StepNumber = styled('span')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: ${SETUP_CARD_ICON_PX};
  height: ${SETUP_CARD_ICON_PX};
  border-radius: 50%;
  background: ${p => p.theme.tokens.background.warning.vibrant};
  color: ${p => p.theme.tokens.content.onVibrant.dark};
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1;
  box-shadow: 0 0 0 2px ${p => p.theme.tokens.border.warning.vibrant};
`;
