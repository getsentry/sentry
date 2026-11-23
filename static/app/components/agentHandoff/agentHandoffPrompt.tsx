import {useId} from 'react';
import styled from '@emotion/styled';
import {IconCopy} from '@sentry/icons/copy';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';

import {HandoffPromptAlerts, HandoffPromptBox} from './handoffPromptParts';
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
  const ipPinningId = useId();
  const ipPinningDescriptionId = useId();

  return (
    <Stack gap="md">
      <HandoffPromptBox
        flow={flow}
        context={context}
        onCopyPrompt={copyPrompt}
        onSelect={onSelect}
        size="md"
      />

      <Flex align="start" gap="md" padding="xs 0">
        <Checkbox
          id={ipPinningId}
          aria-describedby={ipPinningDescriptionId}
          checked={useIpPinning}
          disabled={copyDisabled}
          onChange={toggleIpPinning}
        />
        <Stack gap="sm">
          <Flex align="center" gap="xs">
            <Text as="label" htmlFor={ipPinningId} size="md">
              {t('Only allow this network')}
            </Text>
            <InfoTip
              size="xs"
              title={t('Keeps your secret token safe if the prompt leaks.')}
            />
          </Flex>
          <Description id={ipPinningDescriptionId} size="sm" variant="muted">
            {t(
              'Uncheck if your agent runs in the cloud, or you use iCloud Private Relay.'
            )}
          </Description>
        </Stack>
      </Flex>

      <HandoffPromptAlerts useIpPinning={useIpPinning} error={handoff.error} />

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

// Help text reads best a little looser than the largest density token (1.4).
const Description = styled(Text)`
  line-height: 1.5;
`;
