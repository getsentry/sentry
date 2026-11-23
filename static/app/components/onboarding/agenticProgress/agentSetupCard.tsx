import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {AgentHandoffPrompt} from 'sentry/components/agentHandoff/agentHandoffPrompt';
import {AgentHandoffFlow} from 'sentry/components/agentHandoff/types';
import {Benefit} from 'sentry/components/onboarding/benefit';
import {t} from 'sentry/locale';

import type {AgenticProgressRun} from './types';

export type AgentSetupCopySource = 'prompt';

interface AgentSetupCardProps {
  flow: AgentHandoffFlow;
  onCopyCommand: (source: AgentSetupCopySource, handoffId: string) => void;
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
      <Stack gap="xl" padding="xs 0 xl">
        <CardHeading as="h3" size="xl">
          {t('Set up Sentry using your coding agent')}
        </CardHeading>

        <Stack as="ul" role="list" gap="md" padding="0 0 sm" margin="0">
          <Benefit size="lg">{t('Installs the Sentry CLI and signs you in')}</Benefit>
          <Benefit size="lg">{t('Detects your stack and adds the right SDK')}</Benefit>
          <Benefit size="lg">{t('Sends a test error so you can see it work')}</Benefit>
        </Stack>
      </Stack>

      <AgentHandoffPrompt
        context={run ? {runId: run.runId} : null}
        feedbackSource={feedbackSource}
        flow={flow}
        onCopySuccess={handoffId => onCopyCommand('prompt', handoffId)}
        onSelect={() => onSelectSnippet('prompt')}
      />
    </Fragment>
  );
}

const CardHeading = styled(Heading)`
  color: ${p => p.theme.tokens.content.headings};
`;
