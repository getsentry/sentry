import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Heading, Text} from '@sentry/scraps/text';

import {Hovercard} from 'sentry/components/hovercard';
import {List} from 'sentry/components/list';
import {ListItem} from 'sentry/components/list/listItem';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {IconBot, IconChat, IconCheckmark, IconInfo, IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';

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
}

export function AgentSetupCard({onCopyCommand, prompt}: AgentSetupCardProps) {
  return (
    <Stack height="100%" border="accent" radius="lg" overflow="hidden" gap="0">
      <Stack padding="xl" gap="xl" flex="1">
        <Flex align="center" gap="sm">
          <IconBot size="md" variant="secondary" />
          {/* The slight offset optically aligns the label with the bot icon. */}
          <Container paddingTop="2xs">
            {props => (
              <Text {...props} variant="muted" size="sm" bold uppercase>
                {t('Automatic')}
              </Text>
            )}
          </Container>
        </Flex>

        <Stack gap="md">
          <Heading as="h3" size="lg">
            {t('Set up with your coding agent')}
          </Heading>
          <Text variant="muted" size="md" density="comfortable">
            {t(
              'Install the Sentry plugin, then open your agent in your project and let it handle the rest.'
            )}
          </Text>
        </Stack>

        <List symbol="colored-numeric">
          <ListItem>
            <Stack gap="md" paddingBottom="xl">
              <StepLabel>{t('Install Sentry plugin')}</StepLabel>
              <TextCopyInput
                size="sm"
                monospace
                icon={<IconTerminal size="xs" variant="secondary" />}
                onCopy={() => onCopyCommand('install_command')}
              >
                {INSTALL_PLUGIN_COMMAND}
              </TextCopyInput>
            </Stack>
          </ListItem>
          <ListItem>
            <Stack gap="xl">
              <Stack gap="md">
                <StepLabel>{t('Then open your agent in your project and ask')}</StepLabel>
                <Stack gap="sm">
                  <TextCopyInput
                    size="sm"
                    monospace
                    icon={<IconChat size="xs" variant="secondary" />}
                    onCopy={() => onCopyCommand('prompt')}
                  >
                    {prompt}
                  </TextCopyInput>
                  <Flex>
                    <Hovercard
                      position="top"
                      body={
                        <Stack gap="md">
                          {AGENT_CAPABILITIES.map(capability => (
                            <Flex key={capability} align="center" gap="md">
                              <Flex flexShrink={0}>
                                <IconCheckmark size="sm" variant="success" />
                              </Flex>
                              <Text variant="muted" size="sm">
                                {capability}
                              </Text>
                            </Flex>
                          ))}
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
              <Grid columns="12px 1fr" align="center" gap="sm">
                <Flex justify="center">
                  <StatusIndicator variant="accent" />
                </Flex>
                <Text size="sm" variant="muted">
                  {t('Waiting for agent to connect')}
                </Text>
              </Grid>
            </Stack>
          </ListItem>
        </List>
      </Stack>

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

/**
 * List's numbered marker is a 24px circle pinned to the top of the item, which
 * assumes a taller first line than this small uppercase label. The padding grows
 * the label's box to match, and needs a block box to take effect.
 */
function StepLabel({children}: {children: React.ReactNode}) {
  return (
    <Container padding="xs 0">
      {props => (
        <Text {...props} display="block" size="md">
          {children}
        </Text>
      )}
    </Container>
  );
}
