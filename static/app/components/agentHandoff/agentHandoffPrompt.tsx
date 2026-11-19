import {IconCopy} from '@sentry/icons/copy';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';

import {
  HandoffAdvancedMenu,
  HandoffPromptAlerts,
  HandoffPromptBox,
} from './handoffPromptParts';
import {AgentHandoffFlow, type AgentHandoffContext} from './types';
import {useHandoffPromptCopy} from './useHandoffPromptCopy';

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
  const {copyPrompt, copyDisabled, handoff, useIpPinning, toggleIpPinning} =
    useHandoffPromptCopy({flow, context, onCopySuccess});

  return (
    <Stack gap="md">
      <HandoffPromptBox
        flow={flow}
        context={context}
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

      <Flex align="center" justify="end" gap="sm">
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

      <HandoffPromptAlerts useIpPinning={useIpPinning} error={handoff.error} />
    </Stack>
  );
}
