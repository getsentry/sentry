import {IconCopy} from '@sentry/icons/copy';
import {IconOpen} from '@sentry/icons/open';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';

import {
  getHandoffPreviewUrl,
  HandoffAdvancedMenu,
  HandoffPromptAlerts,
  HandoffPromptBox,
  useHandoffPromptCopy,
  useSentryUrl,
} from './handoffPromptParts';
import {AgentHandoffFlow, type AgentHandoffContext} from './useAgentHandoff';

interface AgentHandoffPromptProps<Flow extends AgentHandoffFlow> {
  context: AgentHandoffContext<Flow> | null;
  feedbackSource: string;
  flow: Flow;
  /** Receives the ID of the handoff whose prompt was copied, for analytics. */
  onCopySuccess?: (handoffId: string) => void;
  onSelect?: () => void;
}

export function AgentHandoffPrompt<Flow extends AgentHandoffFlow>({
  context,
  feedbackSource,
  flow,
  onCopySuccess,
  onSelect,
}: AgentHandoffPromptProps<Flow>) {
  const sentryUrl = useSentryUrl();
  const previewUrl = getHandoffPreviewUrl(flow, sentryUrl);

  const {copyPrompt, copyDisabled, handoff, useIpPinning, toggleIpPinning} =
    useHandoffPromptCopy({flow, context, onCopySuccess});

  return (
    <Stack gap="md">
      <HandoffPromptBox
        onCopyPrompt={copyPrompt}
        onSelect={onSelect}
        topRightAction={
          <Button
            aria-label={t('Copy agent prompt')}
            busy={handoff.isPending}
            disabled={copyDisabled}
            icon={<IconCopy />}
            size="zero"
            variant="transparent"
            onClick={copyPrompt}
          />
        }
      />

      <Flex align="center" justify="between" gap="lg">
        <Text size="sm">
          <ExternalLink href={previewUrl}>
            <Flex as="span" align="center" gap="xs">
              {t('See the full instructions')}
              <IconOpen size="xs" />
            </Flex>
          </ExternalLink>
        </Text>

        <Flex align="center" gap="sm">
          <FeedbackButton
            size="xs"
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
      </Flex>

      <HandoffPromptAlerts useIpPinning={useIpPinning} error={handoff.error} />
    </Stack>
  );
}
