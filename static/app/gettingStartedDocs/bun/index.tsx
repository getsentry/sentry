import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';
import {agentMonitoring} from 'sentry/gettingStartedDocs/node/agentMonitoring';
import {getNodeLogsOnboarding} from 'sentry/gettingStartedDocs/node/utils';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  logsOnboarding: getNodeLogsOnboarding({
    docsPlatform: 'bun',
    packageName: '@sentry/bun',
  }),
  agentMonitoringOnboarding: agentMonitoring({
    packageName: '@sentry/bun',
  }),
};
