import {IconBot} from '@sentry/icons/bot';
import {IconCopy} from '@sentry/icons/copy';
import {IconUser} from '@sentry/icons/user';

import {Button} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

import {ClippedBox} from 'sentry/components/clippedBox';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getAgentSetupPrompt} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {PulseSpacer} from 'sentry/views/insights/pages/onboardingUtils';

type AgentSetupTabsInteraction =
  | {action: 'collapse_prompt' | 'copy_agent_prompt' | 'expand_prompt'}
  | {action: 'switch_tab'; tab: 'agent' | 'human'};

function AgentSetupInstructions({
  prompt,
  waitingIndicator,
  onInteraction,
}: {
  prompt: string;
  waitingIndicator: React.ReactNode;
  onInteraction?: (interaction: AgentSetupTabsInteraction) => void;
}) {
  const {copy} = useCopyToClipboard();

  return (
    <Stack gap="xl" align="start" paddingTop="md">
      <Text>
        {t(
          'Give this prompt to your coding agent to set up agent tracing for this project.'
        )}
      </Text>
      <Container width="100%" border="primary" radius="md" padding="lg">
        {containerProps => (
          <ClippedBox
            {...containerProps}
            clipHeight={150}
            defaultClipped
            collapsible
            buttonProps={{variant: 'secondary', size: 'xs'}}
            onReveal={() => onInteraction?.({action: 'expand_prompt'})}
            onCollapse={() => onInteraction?.({action: 'collapse_prompt'})}
          >
            <Text
              as="div"
              size="sm"
              monospace
              wrap="pre-wrap"
              wordBreak="break-word"
              density="comfortable"
            >
              {prompt}
            </Text>
          </ClippedBox>
        )}
      </Container>
      <Button
        size="md"
        variant="primary"
        icon={<IconCopy />}
        onClick={() => {
          onInteraction?.({action: 'copy_agent_prompt'});
          copy(prompt, {
            successMessage: t('Copied setup prompt to clipboard'),
          });
        }}
      >
        {t('Copy prompt')}
      </Button>
      {waitingIndicator}
      <PulseSpacer />
    </Stack>
  );
}

/**
 * Switches the agent onboarding between a setup prompt for a coding agent and
 * the step-by-step instructions passed as children. The prompt tab is the
 * default whenever the project has a DSN to put in the prompt.
 */
export function AgentSetupTabs({
  project,
  dsn,
  waitingIndicator,
  onInteraction,
  hasPlatformInstructions = true,
  children,
}: {
  children: React.ReactNode;
  project: Project;
  /**
   * Shown below the prompt, usually an indicator that waits for the first
   * events.
   */
  waitingIndicator: React.ReactNode;
  dsn?: string;
  /**
   * Whether the children are step-by-step instructions for the platform. When
   * they are not, the instructions tab is disabled in favor of the prompt.
   */
  hasPlatformInstructions?: boolean;
  onInteraction?: (interaction: AgentSetupTabsInteraction) => void;
}) {
  const organization = useOrganization();
  const prompt = dsn
    ? getAgentSetupPrompt({organizationSlug: organization.slug, project, dsn})
    : undefined;
  const defaultTab = prompt ? 'agent' : 'human';
  const isHumanTabDisabled = Boolean(prompt) && !hasPlatformInstructions;

  return (
    <Tabs
      key={defaultTab}
      defaultValue={defaultTab}
      aria-label={t('Setup instructions')}
      onChange={tab => onInteraction?.({action: 'switch_tab', tab})}
    >
      <TabList variant="floating">
        <TabList.Item
          key="agent"
          textValue={t('For your agent')}
          disabled={!prompt}
          tooltip={
            prompt
              ? undefined
              : {title: t('A project DSN is required to copy a setup prompt.')}
          }
        >
          <IconBot />
          {t('For your agent')}
        </TabList.Item>
        <TabList.Item
          key="human"
          textValue={t('For you')}
          disabled={isHumanTabDisabled}
          tooltip={
            isHumanTabDisabled
              ? {
                  title: t(
                    "Step-by-step instructions aren't available for this platform."
                  ),
                }
              : undefined
          }
        >
          <IconUser />
          {t('For you')}
        </TabList.Item>
      </TabList>
      <TabPanels>
        <TabPanels.Item key="agent">
          {prompt && (
            <AgentSetupInstructions
              prompt={prompt}
              waitingIndicator={waitingIndicator}
              onInteraction={onInteraction}
            />
          )}
        </TabPanels.Item>
        <TabPanels.Item key="human">
          <Container paddingTop="md">{children}</Container>
        </TabPanels.Item>
      </TabPanels>
    </Tabs>
  );
}
