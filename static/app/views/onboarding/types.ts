import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';

export type StepProps = {
  onComplete: (
    selectedPlatforms?: OnboardingSelectedSDK,
    query?: Record<string, string[]>
  ) => void;
  genBackButton?: () => React.ReactNode;
  recentCreatedProject?: Project;
};

export type StepDescriptor = {
  Component: React.ComponentType<StepProps>;
  id: OnboardingStepId;
  title: string;
  hasFooter?: boolean;
};

export enum OnboardingStepId {
  WELCOME = 'welcome',
  SETUP_DOCS = 'setup-docs',
  SCM_CONNECT = 'scm-connect',
  SCM_MESSAGING = 'scm-messaging',
  SCM_PLATFORM_FEATURES = 'scm-platform-features',
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
