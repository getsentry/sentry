import type {ReactNode} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {AgentHandoffPrompt} from 'sentry/components/agentHandoff/agentHandoffPrompt';
import {AgentHandoffFlow} from 'sentry/components/agentHandoff/useAgentHandoff';
import {t, tct} from 'sentry/locale';

import type {AgenticProgressRun} from './types';

export type AgentSetupCopySource = 'prompt';

interface AgentSetupCardProps {
  onCopyCommand: (source: AgentSetupCopySource) => void;
  onSelectSnippet: (source: AgentSetupCopySource) => void;
  run: AgenticProgressRun | undefined;
  feedbackSource?: string;
  unframed?: boolean;
}

export function AgentSetupCard({
  feedbackSource = 'onboarding-agent-setup',
  onCopyCommand,
  onSelectSnippet,
  run,
  unframed = false,
}: AgentSetupCardProps) {
  const emphasis = unframed ? <span /> : <strong />;

  return (
    <Stack
      gap="0"
      background={unframed ? undefined : 'primary'}
      border={unframed ? undefined : 'primary'}
      radius={unframed ? undefined : 'xl'}
      padding={unframed ? undefined : 'xl'}
    >
      <Stack gap={unframed ? '2xs' : 'xs'}>
        <Flex
          align="center"
          justify={unframed ? 'between' : undefined}
          gap={unframed ? 'md' : 'sm'}
          wrap="wrap"
        >
          <Heading as="h3" size="lg">
            {t('Let your agent set up Sentry')}
          </Heading>
          <Tag variant="info">{t('Recommended')}</Tag>
        </Flex>
        <Text as="p" size={unframed ? 'lg' : 'md'} variant="secondary">
          {t('Paste one prompt and your agent does the rest')}
        </Text>
      </Stack>

      <Stack as="ul" role="list" gap={unframed ? 'sm' : 'md'} padding="xl 0" margin="0">
        <Benefit>
          {tct('[emphasis:Detects your stack] and installs the Sentry CLI', {emphasis})}
        </Benefit>
        <Benefit>
          {tct('[emphasis:Installs and configures] the right SDKs', {
            emphasis,
          })}
        </Benefit>
        <Benefit>
          {tct('[emphasis:Sends a test error] to confirm it works', {
            emphasis,
          })}
        </Benefit>
      </Stack>

      <Stack>
        <AgentHandoffPrompt
          context={run ? {runId: run.runId} : null}
          feedbackSource={feedbackSource}
          flow={AgentHandoffFlow.ONBOARDING}
          onCopySuccess={() => onCopyCommand('prompt')}
          onSelect={() => onSelectSnippet('prompt')}
        />
      </Stack>
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
