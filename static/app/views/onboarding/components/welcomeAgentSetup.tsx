import {AgenticSetup} from 'sentry/components/onboarding/agenticProgress/agenticSetup';
import type {AgentSetupCopySource} from 'sentry/components/onboarding/agenticProgress/agentSetupCard';
import type {AgenticProgressRun} from 'sentry/components/onboarding/agenticProgress/types';
import {ManualSetupCard} from 'sentry/components/onboarding/manualSetupCard';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

interface WelcomeAgentSetupProps {
  hasInitFailed: boolean;
  hasProgressFailed: boolean;
  isAgentConnected: boolean;
  onCopyCommand: (source: AgentSetupCopySource) => void;
  onRefresh: () => void;
  onRetry: () => void;
  onSelectSnippet: (source: AgentSetupCopySource) => void;
  onSetupInBrowser: () => void;
  run: AgenticProgressRun | undefined;
  onboardingCode?: string;
}

export function WelcomeAgentSetup({onSetupInBrowser, ...props}: WelcomeAgentSetupProps) {
  const organization = useOrganization();

  const prompt = props.onboardingCode
    ? [
        t('Please help me get started with sentry.'),
        '',
        t('org slug: %s', organization.slug),
        t('run code: %s', props.onboardingCode),
      ].join('\n')
    : t('Please help me get started with sentry.');

  return (
    <AgenticSetup
      {...props}
      prompt={prompt}
      feedbackSource="onboarding-agent-setup"
      issueLinkReferrer="onboarding-agentic-first-issue"
      manualSetup={<ManualSetupCard onSetupInBrowser={onSetupInBrowser} />}
    />
  );
}
