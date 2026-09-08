import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {CodeBlock} from '@sentry/scraps/code';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconBot} from 'sentry/icons';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import type {IconSize} from 'sentry/utils/theme';
import {AgentInfo} from 'sentry/views/onboarding/components/agentInfo';

export type AgentSetupCopySource = 'install_command' | 'prompt';

const INSTALL_PLUGIN_COMMAND = 'npx @sentry/agent-plugin install';

const ICON_SIZE: IconSize = 'md';
const ICON_PX = SvgIcon.ICON_SIZES[ICON_SIZE] as `${number}px`;

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
    <Grid
      columns="max-content 1fr"
      gap="lg xl"
      border="primary"
      radius="xl"
      padding="xl 2xl"
      areas={`
        "icon    title"
        ".       title"
        "stepOne stepOneTitle"
        "line    stepOneBody"
        "stepTwo stepTwoTitle"
        ".       stepTwoBody"
      `}
    >
      <Flex area="icon" align="center" justify="center">
        <IconBot size={ICON_SIZE} variant="secondary" />
      </Flex>
      <Stack area="title" paddingBottom="xl" gap="md">
        <Flex align="center" gap="md" wrap="wrap">
          <Heading as="h3" size="lg">
            {t('Set up with your coding agent')}
          </Heading>
          <Tag variant="info">{t('Recommended')}</Tag>
        </Flex>
        <Stack area="meta" gap="xs">
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
      </Stack>

      <Flex area="stepOne" align="center" justify="center">
        <StepNumber>1</StepNumber>
      </Flex>
      <Container area="stepOneTitle">
        <Text size="md">{t('Install the Sentry plugin for your agent')}</Text>
      </Container>
      <Flex area="line" justify="center">
        <Container borderLeft="muted" />
      </Flex>
      <Container area="stepOneBody" paddingBottom="lg">
        <CodeBlock
          alwaysShowCopyButton
          onCopy={() => onCopyCommand('install_command')}
          wrapMode="wrap"
        >
          {INSTALL_PLUGIN_COMMAND}
        </CodeBlock>
      </Container>

      <Flex area="stepTwo" align="center" justify="center">
        <StepNumber>2</StepNumber>
      </Flex>
      <Container area="stepTwoTitle">
        <Text size="md">{t('Ask your agent to set up Sentry')}</Text>
      </Container>
      <Stack area="stepTwoBody" gap="lg">
        <Text variant="muted" size="md">
          {t('Point it to your project folder and paste this.')}
        </Text>
        <CodeBlock
          alwaysShowCopyButton={!hasSetupFailed}
          hideCopyButton={hasSetupFailed}
          onCopy={() => onCopyCommand('prompt')}
          wrapMode="wrap"
        >
          {prompt}
        </CodeBlock>
      </Stack>
    </Grid>
  );
}

const StepNumber = styled('span')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: ${ICON_PX};
  height: ${ICON_PX};
  border-radius: 50%;
  background: ${p => p.theme.tokens.background.warning.vibrant};
  color: ${p => p.theme.tokens.content.onVibrant.dark};
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1;
  box-shadow: 0 0 0 2px ${p => p.theme.tokens.border.warning.vibrant};
`;
