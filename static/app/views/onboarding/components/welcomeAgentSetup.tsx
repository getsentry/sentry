import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Hovercard} from 'sentry/components/hovercard';
import {List} from 'sentry/components/list';
import {ListItem} from 'sentry/components/list/listItem';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {
  IconBot,
  IconBranch,
  IconChat,
  IconCheckmark,
  IconCode,
  IconGlobe,
  IconInfo,
  IconStack,
  IconTerminal,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {AgentSetupWaiter} from 'sentry/views/onboarding/components/agentSetupWaiter';

type CopySource = 'install_command' | 'prompt';

const INSTALL_PLUGIN_COMMAND = 'npx @sentry/agent-plugin install';

const AGENT_CAPABILITIES = [
  t('Detect your framework and language'),
  t('Create and configure a new Sentry project'),
  t('Install and instrument the Sentry SDK'),
  t('Verify a real error reaches Sentry'),
];

interface WelcomeAgentSetupProps {
  /**
   * Fired when a command is copied out of one of the code blocks.
   */
  onCopyCommand: (source: CopySource) => void;
  /**
   * Leaves the agent path and continues into the step-by-step browser flow.
   */
  onSetupInBrowser: () => void;
}

export function WelcomeAgentSetup({
  onCopyCommand,
  onSetupInBrowser,
}: WelcomeAgentSetupProps) {
  return (
    <Grid
      columns={{'screen:xs': '1fr', 'screen:md': 'repeat(2, 1fr)'}}
      gap="2xl"
      width="100%"
      align="stretch"
    >
      <Stack border="accent" radius="lg" overflow="hidden" gap="0">
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
                  <StepLabel>
                    {t('Then open your agent in your project and ask')}
                  </StepLabel>
                  <Stack gap="sm">
                    <TextCopyInput
                      size="sm"
                      monospace
                      icon={<IconChat size="xs" variant="secondary" />}
                      onCopy={() => onCopyCommand('prompt')}
                    >
                      {t('Help me setup Sentry')}
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
                <AgentSetupWaiter />
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

      <Grid
        columns={{'screen:xs': '1fr', 'screen:md': 'max-content 1fr'}}
        gap="2xl"
        align="stretch"
      >
        <Grid
          columns={{'screen:xs': '1fr max-content 1fr', 'screen:md': 'none'}}
          rows={{'screen:xs': 'none', 'screen:md': '1fr max-content 1fr'}}
          align={{'screen:xs': 'center', 'screen:md': 'stretch'}}
          justifyItems={{'screen:xs': 'stretch', 'screen:md': 'center'}}
          gap="md"
        >
          <SeparatorRule />
          <Text variant="muted" size="sm" bold uppercase>
            {t('or')}
          </Text>
          <SeparatorRule />
        </Grid>

        <Stack
          align="start"
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
            variant="primary"
            onClick={onSetupInBrowser}
            data-test-id="onboarding-setup-in-browser"
          >
            {t('Start setup')}
          </Button>
        </Stack>
      </Grid>
    </Grid>
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

/**
 * List's numbered marker is a 24px circle pinned to the top of the item, which
 * assumes a taller first line than this small uppercase label. The padding grows
 * the label's box to match, and needs a block box to take effect.
 */
function StepLabel({children}: {children: React.ReactNode}) {
  return (
    <Container padding="sm 0">
      {props => (
        <Text {...props} display="block" size="md">
          {children}
        </Text>
      )}
    </Container>
  );
}

/**
 * One of the two rules flanking the "or" label. It draws as a horizontal line
 * while the two setup paths stack, and turns vertical once they sit side by
 * side. The grid stretches it along the line's axis and centers it on the
 * other, so a single border edge is all the rule needs.
 */
function SeparatorRule() {
  return (
    <Container
      borderTop={{'screen:xs': 'secondary', 'screen:md': 'none'}}
      borderLeft={{'screen:xs': 'none', 'screen:md': 'secondary'}}
    />
  );
}
