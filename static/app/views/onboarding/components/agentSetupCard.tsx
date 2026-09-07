import {CodeBlock} from '@sentry/scraps/code';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconBot} from 'sentry/icons';
import {t} from 'sentry/locale';
import {AgentInfo} from 'sentry/views/onboarding/components/agentInfo';

export type AgentSetupCopySource = 'install_command' | 'prompt';

const INSTALL_PLUGIN_COMMAND = 'npx @sentry/agent-plugin install';

interface AgentSetupCardProps {
  onCopyCommand: (source: AgentSetupCopySource) => void;
  prompt: string;
  onboardingCode?: string;
}

export function AgentSetupCard({
  onboardingCode,
  onCopyCommand,
  prompt,
}: AgentSetupCardProps) {
  return (
    <Stack border="primary" radius="xl" overflow="hidden" gap="0">
      <Grid
        columns="min-content 1fr"
        gap="xl lg"
        align="center"
        padding="xl"
        areas={`
          "icon title"
          ".    body"
        `}
      >
        <Flex area="icon" align="center">
          <IconBot size="sm" variant="secondary" />
        </Flex>
        <Container area="title">
          <Heading as="h3" size="lg">
            {t('Set up with your coding agent')}
          </Heading>
        </Container>

        <Stack area="body" gap="2xl">
          <Stack gap="md">
            <Text size="md">{t('First, install the Sentry plugin')}</Text>
            <CodeBlock
              alwaysShowCopyButton
              onCopy={() => onCopyCommand('install_command')}
              wrapMode="wrap"
            >
              {INSTALL_PLUGIN_COMMAND}
            </CodeBlock>
          </Stack>

          <Stack gap="lg">
            <Stack gap="md">
              <Text size="md">{t('Then point your agent to your code and ask')}</Text>
              <CodeBlock
                alwaysShowCopyButton
                onCopy={() => onCopyCommand('prompt')}
                wrapMode="wrap"
              >
                {prompt}
              </CodeBlock>
            </Stack>
            <Flex>
              <AgentInfo onboardingCode={onboardingCode} />
            </Flex>
          </Stack>
        </Stack>
      </Grid>

      <Flex
        align="center"
        justify="center"
        background="secondary"
        borderTop="muted"
        padding="md xl"
      >
        <Text variant="muted" size="sm">
          {t('Works with: Claude, Codex, Grok, and Cursor')}
        </Text>
      </Flex>
    </Stack>
  );
}
