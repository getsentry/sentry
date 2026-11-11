import type {ReactNode} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {AgentHandoffPrompt} from 'sentry/components/agentHandoff/agentHandoffPrompt';
import {AgentHandoffFlow} from 'sentry/components/agentHandoff/useAgentHandoff';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t, tct} from 'sentry/locale';

import type {AgenticProgressRun} from './types';

export type AgentSetupCopySource = 'prompt';

interface AgentSetupCardProps {
  onCopyCommand: (source: AgentSetupCopySource) => void;
  onSelectSnippet: (source: AgentSetupCopySource) => void;
  run: AgenticProgressRun | undefined;
  feedbackSource?: string;
}

export function AgentSetupCard({
  feedbackSource = 'onboarding-agent-setup',
  onCopyCommand,
  onSelectSnippet,
  run,
}: AgentSetupCardProps) {
  return (
    <Stack gap="0" background="primary" border="primary" radius="xl" padding="xl">
      <Stack gap="xs">
        <Flex align="center" gap="sm" wrap="wrap">
          <Heading as="h3" size="lg">
            {t('Let your agent set up Sentry')}
          </Heading>
          <Tag variant="info">{t('Recommended')}</Tag>
        </Flex>
        <Text as="p" size="md" variant="secondary">
          {t('Paste one prompt and your agent does the rest.')}
        </Text>
      </Stack>

      <Stack as="ul" role="list" gap="md" padding="xl 0">
        <Benefit>{tct('[emphasis:Detects your stack]', {emphasis: <strong />})}</Benefit>
        <Benefit>
          {tct('[emphasis:Installs and configures the SDKs] in your code', {
            emphasis: <strong />,
          })}
        </Benefit>
        <Benefit>
          {tct('[emphasis:Sends a test error] and confirms it, so you know it works', {
            emphasis: <strong />,
          })}
        </Benefit>
      </Stack>

      <Stack>
        <AgentHandoffPrompt
          context={run ? {runId: run.runId} : null}
          flow={AgentHandoffFlow.ONBOARDING}
          onCopySuccess={() => onCopyCommand('prompt')}
          onSelect={() => onSelectSnippet('prompt')}
        />
      </Stack>

      <Flex justify="end" paddingTop="lg">
        <FeedbackButton
          size="xs"
          feedbackOptions={{
            tags: {'feedback.source': feedbackSource},
          }}
        />
      </Flex>
    </Stack>
  );
}

function Benefit({children}: {children: ReactNode}) {
  return (
    <Flex as="li" align="center" gap="sm">
      <IconCheckmark size="sm" variant="success" />
      <Text size="md">{children}</Text>
    </Flex>
  );
}
