import {Button} from '@sentry/scraps/button';
import {CodeBlock, InlineCode} from '@sentry/scraps/code';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Hovercard} from 'sentry/components/hovercard';
import {IconBot, IconCheckmark, IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

export type AgentSetupCopySource = 'install_command' | 'prompt';

const INSTALL_PLUGIN_COMMAND = 'npx @sentry/agent-plugin install';

const AGENT_CAPABILITIES = [
  t('Detect your framework and language'),
  t('Create and configure a new Sentry project'),
  t('Install and instrument the Sentry SDK'),
  t('Verify a real error reaches Sentry'),
];

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
        // The body hangs off the title's column rather than the card's edge, so
        // the icon is the only thing outdented.
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
              <Hovercard
                position="top"
                body={
                  <Stack gap="xl">
                    <Stack gap="md">
                      {AGENT_CAPABILITIES.map(capability => (
                        <Grid key={capability} columns="16px 1fr" align="center" gap="md">
                          <Flex justify="center">
                            <IconCheckmark size="sm" variant="success" />
                          </Flex>
                          <Text variant="muted" size="sm">
                            {capability}
                          </Text>
                        </Grid>
                      ))}
                    </Stack>
                    {onboardingCode ? (
                      <Grid columns="16px 1fr" align="start" gap="md">
                        <Flex justify="center" paddingTop="2xs">
                          <IconInfo size="xs" variant="secondary" />
                        </Flex>
                        <Text variant="muted" size="sm">
                          {tct(
                            'Your agent uses ID [onboardingCode] to report setup progress here. Progress updates sent with this ID never include any part of your source code.',
                            {
                              onboardingCode: <InlineCode>{onboardingCode}</InlineCode>,
                            }
                          )}
                        </Text>
                      </Grid>
                    ) : null}
                  </Stack>
                }
              >
                <Button
                  variant="link"
                  size="zero"
                  icon={<IconInfo variant="secondary" />}
                >
                  <Text size="sm" variant="muted" underline="dotted">
                    {t('What will my agent do?')}
                  </Text>
                </Button>
              </Hovercard>
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
          {t('Works with: Claude, Codex, Grok, Cursor, Pi, and OpenCode')}
        </Text>
      </Flex>
    </Stack>
  );
}
