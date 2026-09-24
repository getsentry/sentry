import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';
import {agentMonitoring} from 'sentry/gettingStartedDocs/node/agentMonitoring';
import {featureFlag} from 'sentry/gettingStartedDocs/node/featureFlag';

import {crashReport} from './crashReport';
import {logs} from './logs';
import {mcp} from './mcp';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {PACKAGE_NAME, sentryImport} from './utils';

export const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  featureFlagOnboarding: featureFlag({
    packageName: PACKAGE_NAME,
    sentryImport,
  }),
  agentMonitoringOnboarding: agentMonitoring({
    packageName: PACKAGE_NAME,
  }),
  logsOnboarding: logs,
  mcpOnboarding: mcp,
  metricsOnboarding: metrics,
};
