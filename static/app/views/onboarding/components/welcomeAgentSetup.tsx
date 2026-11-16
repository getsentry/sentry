import {AgenticSetup} from 'sentry/components/onboarding/agenticProgress/agenticSetup';
import type {AgentSetupCopySource} from 'sentry/components/onboarding/agenticProgress/agentSetupCard';
import type {AgenticProgressRun} from 'sentry/components/onboarding/agenticProgress/types';

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
  return (
    <AgenticSetup
      {...props}
      layered
      feedbackSource="onboarding-agent-setup"
      issueLinkReferrer="onboarding-agentic-first-issue"
      onSetupInBrowser={onSetupInBrowser}
    />
  );
}
