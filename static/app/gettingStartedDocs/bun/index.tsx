import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/javascript/agentMonitoring';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';
import {featureFlag} from 'sentry/gettingStartedDocs/node/featureFlag';
import {getNodeLogsOnboarding} from 'sentry/gettingStartedDocs/node/utils';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  featureFlagOnboarding: featureFlag({
    packageName: '@sentry/bun',
  }),
  logsOnboarding: getNodeLogsOnboarding({
    docsPlatform: 'bun',
    packageName: '@sentry/bun',
  }),
  agentMonitoringOnboarding: agentMonitoring({
    packageName: '@sentry/bun',
  }),
};
