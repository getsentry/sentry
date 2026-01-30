import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';

export type StepProps = {
  genSkipOnboardingLink: () => React.ReactNode;
  onComplete: (selectedPlatforms?: OnboardingSelectedSDK) => void;
  stepIndex: number;
  recentCreatedProject?: Project;
};

export type StepDescriptor = {
  Component: React.ComponentType<StepProps>;
  cornerVariant: 'top-right' | 'top-left';
  id: OnboardingStepId;
  title: string;
  hasFooter?: boolean;
};

export enum OnboardingStepId {
  WELCOME = 'welcome',
  SELECT_PLATFORM = 'select-platform',
  SETUP_DOCS = 'setup-docs',
}

export enum OnboardingWelcomeProductId {
  ERROR_MONITORING = 'error-monitoring',
  LOGGING = 'logging',
  SESSION_REPLAY = 'session-replay',
  TRACING = 'tracing',
  METRICS = 'metrics',
  PROFILING = 'profiling',
  AGENT_MONITORING = 'agent-monitoring',
  SEER = 'seer',
}
