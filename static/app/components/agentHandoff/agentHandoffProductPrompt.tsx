import {IconCopy} from '@sentry/icons/copy';
import {IconOpen} from '@sentry/icons/open';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {List} from 'sentry/components/list';
import {ListItem} from 'sentry/components/list/listItem';
import {t} from 'sentry/locale';

import {
  getHandoffPreviewUrl,
  HandoffAdvancedMenu,
  HandoffPromptAlerts,
  HandoffPromptBox,
  useHandoffPromptCopy,
  useSentryUrl,
} from './handoffPromptParts';
import {AgentHandoffFlow, type AddFeatureContext} from './useAgentHandoff';

interface AgentHandoffProductPromptProps {
  /**
   * Short phrases describing what the agent will do, shown as checkmark bullets above
   * "View all instructions". Keep to 3–5 items.
   */
  agentSteps: string[];
  context: AddFeatureContext | null;
  feedbackSource: string;
  onCopySuccess?: (handoffId: string) => void;
  onSelect?: () => void;
}

export function AgentHandoffProductPrompt({
  agentSteps,
  context,
  feedbackSource,
  onCopySuccess,
  onSelect,
}: AgentHandoffProductPromptProps) {
  const sentryUrl = useSentryUrl();
  const previewUrl = getHandoffPreviewUrl(AgentHandoffFlow.ADD_FEATURE, sentryUrl);

  const {copyPrompt, copyDisabled, handoff, useIpPinning, toggleIpPinning} =
    useHandoffPromptCopy({
      flow: AgentHandoffFlow.ADD_FEATURE,
      context,
      onCopySuccess,
    });

  return (
    <Stack gap="md">
      <Text size="sm" variant="secondary">
        {t('Paste this prompt into your coding agent')}
      </Text>

      <HandoffPromptBox
        product={context?.product}
        onCopyPrompt={copyPrompt}
        onSelect={onSelect}
      />

      <Flex align="center" gap="sm">
        <Button
          busy={handoff.isPending}
          disabled={copyDisabled}
          icon={<IconCopy />}
          variant="primary"
          size="sm"
          onClick={copyPrompt}
        >
          {t('Copy prompt')}
        </Button>

        <FeedbackButton
          size="sm"
          feedbackOptions={{
            tags: {'feedback.source': feedbackSource},
          }}
        />

        <HandoffAdvancedMenu
          disabled={copyDisabled}
          useIpPinning={useIpPinning}
          onToggle={toggleIpPinning}
        />
      </Flex>

      <HandoffPromptAlerts useIpPinning={useIpPinning} error={handoff.error} />

      <Stack gap="xs">
        <Text size="sm" variant="secondary">
          {t('Your agent will:')}
        </Text>
        <List symbol="bullet">
          {[
            ...agentSteps.map(step => (
              <ListItem key={step}>
                <Text size="sm">{step}</Text>
              </ListItem>
            )),
            <ListItem key="view-all-instructions">
              <Text size="sm">
                <ExternalLink href={previewUrl}>
                  <Flex as="span" align="center" gap="xs">
                    {t('View all instructions')}
                    <IconOpen size="xs" />
                  </Flex>
                </ExternalLink>
              </Text>
            </ListItem>,
          ]}
        </List>
      </Stack>
    </Stack>
  );
}
