import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

import {agentMonitoring} from './agentMonitoring';
import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  feedbackOnboardingJsLoader,
  agentMonitoringOnboarding: agentMonitoring,
};
