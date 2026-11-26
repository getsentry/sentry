import {IconCopy} from '@sentry/icons/copy';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';

import {HandoffPromptBox, HandoffPromptError} from './handoffPromptParts';
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
  const {copyPrompt, copyDisabled, handoff} = useHandoffPromptCopy({
    flow,
    context,
    onCopySuccess,
  });

  return (
    <Stack gap="md">
      <HandoffPromptBox
        flow={flow}
        context={context}
        onCopyPrompt={copyPrompt}
        onSelect={onSelect}
        size="md"
      />

      <HandoffPromptError error={handoff.error} />

      <Button
        disabled={copyDisabled}
        icon={<IconCopy />}
        variant="primary"
        onClick={copyPrompt}
      >
        {t('Copy prompt')}
      </Button>

      <Flex justify="end" paddingTop="xs">
        <FeedbackButton
          size="xs"
          feedbackOptions={{tags: {'feedback.source': feedbackSource}}}
        >
          {t('Give feedback')}
        </FeedbackButton>
      </Flex>
    </Stack>
  );
}
