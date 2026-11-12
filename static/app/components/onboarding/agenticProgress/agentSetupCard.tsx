import {Fragment, type ReactNode} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {AgentHandoffPrompt} from 'sentry/components/agentHandoff/agentHandoffPrompt';
import {AgentHandoffFlow} from 'sentry/components/agentHandoff/useAgentHandoff';
import {t} from 'sentry/locale';

import type {AgenticProgressRun} from './types';

export type AgentSetupCopySource = 'prompt';

interface AgentSetupCardProps {
  flow: AgentHandoffFlow;
  onCopyCommand: (source: AgentSetupCopySource) => void;
  onSelectSnippet: (source: AgentSetupCopySource) => void;
  run: AgenticProgressRun | undefined;
  feedbackSource?: string;
}

export function AgentSetupCard({
  feedbackSource = 'onboarding-agent-setup',
  flow,
  onCopyCommand,
  onSelectSnippet,
  run,
}: AgentSetupCardProps) {
  return (
    <Fragment>
      <Stack gap="2xs">
        <Flex align="center" justify="between" gap="md" wrap="wrap">
          <Heading as="h3" size="lg">
            {t('Let your agent set up Sentry')}
          </Heading>
          <Tag variant="info">{t('Recommended')}</Tag>
        </Flex>
        <Text as="p" size="lg" variant="secondary">
          {t('Paste one prompt and your agent does the rest')}
        </Text>
      </Stack>

      <Stack as="ul" role="list" gap="sm" padding="xl 0" margin="0">
        <Benefit>{t('Detects your stack and installs the Sentry CLI')}</Benefit>
        <Benefit>{t('Installs and configures the right SDKs')}</Benefit>
        <Benefit>{t('Sends a test error to confirm it works')}</Benefit>
      </Stack>

      <AgentHandoffPrompt
        context={run ? {runId: run.runId} : null}
        feedbackSource={feedbackSource}
        flow={flow}
        onCopySuccess={() => onCopyCommand('prompt')}
        onSelect={() => onSelectSnippet('prompt')}
      />
    </Fragment>
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
