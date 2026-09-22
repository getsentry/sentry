import {useRef} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {CodeBlock} from '@sentry/scraps/code';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {List} from 'sentry/components/list';
import {ListItem} from 'sentry/components/list/listItem';
import {IconBot} from 'sentry/icons';
import {t} from 'sentry/locale';
import {selectText} from 'sentry/utils/selectText';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AgentInfo} from 'sentry/views/onboarding/components/agentInfo';
import {SETUP_CARD_ICON_SIZE, SETUP_CARD_MARKER_PX} from 'sentry/views/onboarding/consts';

export type AgentSetupCopySource = 'install_command' | 'prompt';

const INSTALL_PLUGIN_COMMAND = 'npx @sentry/agent-plugin install';

const SUPPORTED_AGENTS = ['Claude Code', 'Codex', 'Cursor', 'Grok'];
const SUPPORTED_AGENTS_LABEL = new Intl.ListFormat(undefined, {
  style: 'short',
  type: 'conjunction',
}).format(SUPPORTED_AGENTS);

interface AgentSetupCardProps {
  onCopyCommand: (source: AgentSetupCopySource) => void;
  onSelectSnippet: (source: AgentSetupCopySource) => void;
  prompt: string;
  hasSetupFailed?: boolean;
  onboardingCode?: string;
}

export function AgentSetupCard({
  hasSetupFailed,
  onboardingCode,
  onCopyCommand,
  onSelectSnippet,
  prompt,
}: AgentSetupCardProps) {
  const organization = useOrganization();
  const installCommand = onboardingCode
    ? `${INSTALL_PLUGIN_COMMAND} ${organization.slug}#${onboardingCode}`
    : INSTALL_PLUGIN_COMMAND;
  const installCommandRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);

  const handleSelectSnippet = (
    event: React.MouseEvent<HTMLElement>,
    snippet: HTMLDivElement | null,
    source: AgentSetupCopySource
  ) => {
    if (
      !snippet ||
      !(event.target instanceof Element) ||
      !snippet.contains(event.target) ||
      event.target.closest('button')
    ) {
      return;
    }

    const code = snippet.querySelector('code');
    if (!code) {
      return;
    }

    selectText(code);
    onSelectSnippet(source);
  };

  return (
    <Grid
      columns={`${SETUP_CARD_MARKER_PX} 1fr`}
      gap="0 md"
      background="primary"
      border="primary"
      radius="xl"
      padding="xl"
      areas={`
        "icon  title"
        ".     meta"
        "steps steps"
      `}
    >
      <Flex area="icon" align="center" justify="center">
        <IconBot size={SETUP_CARD_ICON_SIZE} variant="secondary" />
      </Flex>
      <Flex area="title" align="center" justify="between" gap="md" wrap="wrap">
        <Flex align="center" gap="md" wrap="wrap">
          <Heading as="h3" size="lg">
            {t('Set up with your coding agent')}
          </Heading>
          <Tag variant="info">{t('Recommended')}</Tag>
        </Flex>
        <FeedbackButton
          size="xs"
          feedbackOptions={{
            tags: {'feedback.source': 'onboarding-agent-setup'},
          }}
        />
      </Flex>

      <Stack area="meta" gap="xs" paddingTop="md" paddingBottom="2xl">
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

      <Container area="steps">
        <List symbol="colored-numeric">
          <ListItem>
            <Stack
              gap="lg"
              paddingTop="xs"
              paddingBottom="2xl"
              onClick={event =>
                handleSelectSnippet(event, installCommandRef.current, 'install_command')
              }
            >
              <Text size="md">{t('Install the Sentry plugin for your agent')}</Text>
              <CodeBlock
                ref={installCommandRef}
                dark
                alwaysShowCopyButton
                onCopy={() => onCopyCommand('install_command')}
                wrapMode="wrap"
              >
                {installCommand}
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
            <Stack
              gap="lg"
              paddingTop="xs"
              onClick={event => handleSelectSnippet(event, promptRef.current, 'prompt')}
            >
              <Stack gap="xs">
                <Text size="md">{t('Ask your agent to set up Sentry')}</Text>
                <Text variant="muted" size="md">
                  {t('Point it to your project folder and paste this.')}
                </Text>
              </Stack>
              <CodeBlock
                ref={promptRef}
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
      </Container>
    </Grid>
  );
}
