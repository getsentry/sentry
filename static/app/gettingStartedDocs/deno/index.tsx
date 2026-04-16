import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';
import {featureFlag} from 'sentry/gettingStartedDocs/node/featureFlag';

import {agentMonitoring} from './agentMonitoring';
import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  feedbackOnboardingJsLoader,
  featureFlagOnboarding: featureFlag({
    packageName: '@sentry/deno',
    sentryImport: 'import * as Sentry from "npm:@sentry/deno";',
  }),
  agentMonitoringOnboarding: agentMonitoring,
};
