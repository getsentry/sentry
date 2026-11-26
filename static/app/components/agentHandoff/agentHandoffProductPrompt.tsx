import styled from '@emotion/styled';
import {IconCopy} from '@sentry/icons/copy';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';

import {HandoffPromptBox, HandoffPromptError} from './handoffPromptParts';
import {AgentHandoffFlow, type AddFeatureContext} from './types';
import {useHandoffPromptCopy} from './useHandoffPromptCopy';

interface AgentHandoffProductPromptProps {
  /**
   * Short phrases describing what the agent will do, shown as bullets under the prompt.
   * Keep to 3–5 items.
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
  const {copyPrompt, copyDisabled, handoff} = useHandoffPromptCopy({
    flow: AgentHandoffFlow.ADD_FEATURE,
    context,
    onCopySuccess,
  });

  return (
    <Stack gap="2xl">
      {/* The steps sit beside the prompt once the card is wide enough for both. */}
      <Grid
        columns={{zero: 'minmax(0, 1fr)', '3xl': 'minmax(0, 1fr) minmax(0, 340px)'}}
        gap="2xl"
        align="start"
      >
        <Stack gap="md">
          <HandoffPromptBox
            flow={AgentHandoffFlow.ADD_FEATURE}
            context={context}
            onCopyPrompt={copyPrompt}
            onSelect={onSelect}
          />

          <Flex justify="end" paddingTop="xs">
            <Button
              aria-label={t('Copy prompt')}
              disabled={copyDisabled}
              icon={<IconCopy />}
              variant="primary"
              onClick={copyPrompt}
            >
              {t('Copy')}
            </Button>
          </Flex>

          <HandoffPromptError error={handoff.error} />
        </Stack>

        <Stack gap="lg">
          <Heading as="h3" size="md">
            {t('Your agent will')}
          </Heading>
          <Stack as="ul" role="list" gap="md" margin="0" padding="0">
            {agentSteps.map(step => (
              <Flex as="li" key={step} align="center" gap="md">
                <StepBullet aria-hidden />
                <Text size="md" density="comfortable">
                  {step}
                </Text>
              </Flex>
            ))}
          </Stack>
        </Stack>
      </Grid>

      <Flex justify="end">
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

const StepBullet = styled('span')`
  flex-shrink: 0;
  width: 4px;
  height: 4px;
  border-radius: ${p => p.theme.radius.full};
  background: ${p => p.theme.tokens.graphics.neutral.moderate};
`;
